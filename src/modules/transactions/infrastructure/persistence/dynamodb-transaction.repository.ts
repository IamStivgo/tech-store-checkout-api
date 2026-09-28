import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  GetCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { combine, err, ok, ResultAsync, type Result } from '../../../../shared/domain/result';
import type { Transaction } from '../../domain/transaction.entity';
import { PaymentAlreadySubmittedError } from '../../domain/transaction.errors';
import type { TransactionRepository } from '../../domain/transaction.repository.port';

import { PENDING_BUCKET, toPaymentItem, toTransaction } from './transaction.mapper';
import { PENDING_INDEX, REFERENCE_INDEX } from './transactions-table.definition';

const isConditionFailure = (cause: unknown): boolean =>
  cause instanceof ConditionalCheckFailedException;

export class DynamoDbTransactionRepository implements TransactionRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  findById(id: string): ResultAsync<Transaction | null, PersistenceError> {
    return ResultAsync.fromPromise(
      // Buyers read their transaction right after creating or paying it.
      this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { transactionId: id },
          ConsistentRead: true,
        }),
      ),
      (cause) => new PersistenceError('transactions.findById', cause),
    ).andThen(({ Item }) => (Item ? toTransaction(Item) : ok(null)));
  }

  findByReference(reference: string): ResultAsync<Transaction | null, PersistenceError> {
    return ResultAsync.fromPromise(
      this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: REFERENCE_INDEX,
          KeyConditionExpression: 'reference = :reference',
          ExpressionAttributeValues: { ':reference': reference },
          Limit: 1,
        }),
      ),
      (cause) => new PersistenceError('transactions.findByReference', cause),
    ).andThen(({ Items = [] }) => {
      const [item] = Items;
      return item ? toTransaction(item) : ok(null);
    });
  }

  findPending(limit: number): ResultAsync<Transaction[], PersistenceError> {
    return ResultAsync.fromPromise(
      this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: PENDING_INDEX,
          KeyConditionExpression: 'pendingBucket = :bucket',
          ExpressionAttributeValues: { ':bucket': PENDING_BUCKET },
          ScanIndexForward: true,
          Limit: limit,
        }),
      ),
      (cause) => new PersistenceError('transactions.findPending', cause),
    ).andThen(({ Items = [] }) => combine(Items.map((item) => toTransaction(item))));
  }

  claimPaymentSubmission(
    claimed: Transaction,
  ): ResultAsync<void, PaymentAlreadySubmittedError | PersistenceError> {
    const payment = claimed.payment;
    if (!payment) {
      return new ResultAsync(
        Promise.resolve(
          err(new PersistenceError('transactions.claimPayment', 'no payment claimed')),
        ),
      );
    }
    const update = this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { transactionId: claimed.id },
        UpdateExpression: 'SET payment = :payment, updatedAt = :now',
        ConditionExpression:
          '#status = :pending AND attribute_not_exists(payment) AND reservationExpiresAt > :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':payment': toPaymentItem(payment),
          ':now': claimed.updatedAt.toISOString(),
          ':pending': 'PENDING',
        },
      }),
    );
    return new ResultAsync(
      update.then(
        (): Result<void, PaymentAlreadySubmittedError | PersistenceError> => ok(undefined),
        (cause: unknown) =>
          // Another attempt claimed it first (or the reservation expired in the meantime).
          err(
            isConditionFailure(cause)
              ? new PaymentAlreadySubmittedError()
              : new PersistenceError('transactions.claimPayment', cause),
          ),
      ),
    );
  }

  releasePaymentClaim(
    transactionId: string,
    attemptId: string,
  ): ResultAsync<void, PersistenceError> {
    return this.updateOwnPayment('transactions.releasePaymentClaim', {
      TableName: this.tableName,
      Key: { transactionId },
      UpdateExpression: 'REMOVE payment',
      ConditionExpression: 'payment.attemptId = :attemptId',
      ExpressionAttributeValues: { ':attemptId': attemptId },
    });
  }

  recordProviderPayment(transaction: Transaction): ResultAsync<void, PersistenceError> {
    const payment = transaction.payment;
    if (!payment) {
      return new ResultAsync(Promise.resolve(ok(undefined)));
    }
    return this.updateOwnPayment('transactions.recordProviderPayment', {
      TableName: this.tableName,
      Key: { transactionId: transaction.id },
      UpdateExpression: 'SET payment = :payment, updatedAt = :now',
      ConditionExpression: 'payment.attemptId = :attemptId',
      ExpressionAttributeValues: {
        ':payment': toPaymentItem(payment),
        ':now': transaction.updatedAt.toISOString(),
        ':attemptId': payment.attemptId,
      },
    });
  }

  // Only the attempt that claimed the payment may change it; another attempt's claim is left alone.
  private updateOwnPayment(
    operation: string,
    input: ConstructorParameters<typeof UpdateCommand>[0],
  ): ResultAsync<void, PersistenceError> {
    return new ResultAsync(
      this.client.send(new UpdateCommand(input)).then(
        (): Result<void, PersistenceError> => ok(undefined),
        (cause: unknown): Result<void, PersistenceError> =>
          isConditionFailure(cause) ? ok(undefined) : err(new PersistenceError(operation, cause)),
      ),
    );
  }
}
