import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { TransactWriteCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { err, ok, ResultAsync, type Result } from '../../../../shared/domain/result';
import type { Delivery } from '../../../deliveries/domain/delivery.entity';
import { toDeliveryItem } from '../../../deliveries/infrastructure/persistence/delivery.mapper';
import { ProductNotFoundError } from '../../../products/domain/product.errors';
import type { ApplyOutcome, CheckoutUnitOfWork } from '../../domain/checkout-unit-of-work.port';
import type { TransactionEvent } from '../../domain/transaction-event';
import type { Transaction } from '../../domain/transaction.entity';
import { InsufficientStockError } from '../../domain/transaction.errors';

import { toEventPuts } from './transaction-event.mapper';
import { toPaymentItem, toTransactionItem } from './transaction.mapper';

export interface CheckoutTables {
  readonly products: string;
  readonly transactions: string;
  readonly deliveries: string;
  readonly transactionEvents: string;
}

const CONDITION_FAILED = 'ConditionalCheckFailed';

/** Raw attribute values of the product the reservation read (`ALL_OLD`), unmarshalled by hand. */
interface ProductOnFailure {
  readonly active?: { readonly BOOL?: boolean };
  readonly stockAvailable?: { readonly N?: string };
}

const reasonsOf = (cause: unknown) =>
  cause instanceof TransactionCanceledException ? (cause.CancellationReasons ?? []) : undefined;

/** DynamoDB transactions over the products and transactions tables (data model §4). */
export class DynamoDbCheckoutUnitOfWork implements CheckoutUnitOfWork {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: CheckoutTables,
  ) {}

  reserveStockAndCreate(
    transaction: Transaction,
    events: readonly TransactionEvent[],
  ): ResultAsync<void, InsufficientStockError | ProductNotFoundError | PersistenceError> {
    const now = transaction.createdAt.toISOString();
    const write = this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.tables.products,
              Key: { productId: transaction.productId },
              UpdateExpression:
                'SET stockAvailable = stockAvailable - :quantity, stockReserved = stockReserved + :quantity, updatedAt = :now ADD version :one',
              ConditionExpression:
                'attribute_exists(productId) AND active = :active AND stockAvailable >= :quantity',
              ExpressionAttributeValues: {
                ':quantity': transaction.quantity,
                ':now': now,
                ':one': 1,
                ':active': true,
              },
              // The failed item tells how many units are left without another read.
              ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
            },
          },
          {
            Put: {
              TableName: this.tables.transactions,
              Item: toTransactionItem(transaction),
              ConditionExpression: 'attribute_not_exists(transactionId)',
            },
          },
          ...toEventPuts(this.tables.transactionEvents, events),
        ],
      }),
    );

    return new ResultAsync(
      write.then(
        (): Result<void, InsufficientStockError | ProductNotFoundError | PersistenceError> =>
          ok(undefined),
        (cause: unknown) => err(this.reservationError(cause)),
      ),
    );
  }

  approveAndAssignDelivery(
    transaction: Transaction,
    delivery: Delivery,
    events: readonly TransactionEvent[],
  ): ResultAsync<ApplyOutcome, PersistenceError> {
    const now = transaction.updatedAt.toISOString();
    return this.finalize(
      'transactions.approveAndAssignDelivery',
      this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            this.finalTransactionUpdate(transaction, {
              extraSet: ', deliveryId = :deliveryId',
              extraValues: { ':deliveryId': delivery.id },
            }),
            {
              Update: {
                TableName: this.tables.products,
                Key: { productId: transaction.productId },
                UpdateExpression:
                  'SET stockReserved = stockReserved - :quantity, stockSold = stockSold + :quantity, updatedAt = :now ADD version :one',
                ConditionExpression: 'stockReserved >= :quantity',
                ExpressionAttributeValues: {
                  ':quantity': transaction.quantity,
                  ':now': now,
                  ':one': 1,
                },
              },
            },
            {
              Put: {
                TableName: this.tables.deliveries,
                Item: toDeliveryItem(delivery),
                ConditionExpression: 'attribute_not_exists(deliveryId)',
              },
            },
            ...toEventPuts(this.tables.transactionEvents, events),
          ],
        }),
      ),
    );
  }

  closeAndReleaseStock(
    transaction: Transaction,
    events: readonly TransactionEvent[],
  ): ResultAsync<ApplyOutcome, PersistenceError> {
    const now = transaction.updatedAt.toISOString();
    return this.finalize(
      'transactions.closeAndReleaseStock',
      this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            this.finalTransactionUpdate(transaction),
            {
              Update: {
                TableName: this.tables.products,
                Key: { productId: transaction.productId },
                UpdateExpression:
                  'SET stockAvailable = stockAvailable + :quantity, stockReserved = stockReserved - :quantity, updatedAt = :now ADD version :one',
                ConditionExpression: 'stockReserved >= :quantity',
                ExpressionAttributeValues: {
                  ':quantity': transaction.quantity,
                  ':now': now,
                  ':one': 1,
                },
              },
            },
            ...toEventPuts(this.tables.transactionEvents, events),
          ],
        }),
      ),
    );
  }

  /** Moves the transaction from PENDING to its final state, storing its payment if it has one. */
  private finalTransactionUpdate(
    transaction: Transaction,
    {
      extraSet = '',
      extraValues = {},
    }: { extraSet?: string; extraValues?: Record<string, unknown> } = {},
  ) {
    const { payment } = transaction;
    // A payment claimed in the meantime must not be cancelled or expired from under it.
    const noPayment = payment ? '' : ' AND attribute_not_exists(payment)';
    const setPayment = payment ? ', payment = :payment' : '';
    return {
      Update: {
        TableName: this.tables.transactions,
        Key: { transactionId: transaction.id },
        UpdateExpression: `SET #status = :status, finalizedAt = :finalizedAt, updatedAt = :now${setPayment}${extraSet} REMOVE pendingBucket, pendingSince`,
        ConditionExpression: `#status = :pending${noPayment}`,
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': transaction.status,
          ':finalizedAt': (transaction.finalizedAt ?? transaction.updatedAt).toISOString(),
          ':now': transaction.updatedAt.toISOString(),
          ':pending': 'PENDING',
          ...(payment ? { ':payment': toPaymentItem(payment) } : {}),
          ...extraValues,
        },
      },
    };
  }

  private finalize(
    operation: string,
    write: Promise<unknown>,
  ): ResultAsync<ApplyOutcome, PersistenceError> {
    return new ResultAsync(
      write.then(
        (): Result<ApplyOutcome, PersistenceError> => ok('applied'),
        (cause: unknown): Result<ApplyOutcome, PersistenceError> =>
          // The transaction was no longer PENDING: another path closed it first (data model §4.5).
          reasonsOf(cause)?.[0]?.Code === CONDITION_FAILED
            ? ok('already-final')
            : err(new PersistenceError(operation, cause)),
      ),
    );
  }

  private reservationError(
    cause: unknown,
  ): InsufficientStockError | ProductNotFoundError | PersistenceError {
    const productReason = reasonsOf(cause)?.[0];
    if (productReason?.Code !== CONDITION_FAILED) {
      return new PersistenceError('transactions.reserveStockAndCreate', cause);
    }
    const product = productReason.Item as ProductOnFailure | undefined;
    if (product?.active?.BOOL !== true) {
      return new ProductNotFoundError();
    }
    return new InsufficientStockError(Number(product.stockAvailable?.N ?? 0));
  }
}
