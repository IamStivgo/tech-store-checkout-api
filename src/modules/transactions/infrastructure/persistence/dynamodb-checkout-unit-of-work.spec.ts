import {
  DynamoDBClient,
  TransactionCanceledException,
  type CancellationReason,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import { aProviderPayment } from '../../../../../test/builders/provider-payment.builder';
import {
  aStoredTransaction,
  aTransaction,
  PRODUCT_ID,
  TRANSACTION_ID,
} from '../../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../../test/builders/unwrap';
import { Delivery } from '../../../deliveries/domain/delivery.entity';

import { DynamoDbCheckoutUnitOfWork } from './dynamodb-checkout-unit-of-work';

const TABLES = {
  products: 'test-products',
  transactions: 'test-transactions',
  deliveries: 'test-deliveries',
};
const cancelled = (...reasons: CancellationReason[]) =>
  new TransactionCanceledException({
    message: 'Transaction cancelled',
    $metadata: {},
    CancellationReasons: reasons,
  });

describe('DynamoDbCheckoutUnitOfWork', () => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
  const dynamo = mockClient(client);
  const unitOfWork = new DynamoDbCheckoutUnitOfWork(client, TABLES);
  const items = () =>
    dynamo.commandCalls(TransactWriteCommand)[0]?.args[0].input.TransactItems ?? [];

  beforeEach(() => {
    dynamo.reset();
  });

  describe('reserveStockAndCreate', () => {
    it('reserves the units of an active product and creates the transaction together', async () => {
      dynamo.on(TransactWriteCommand).resolves({});

      unwrap(await unitOfWork.reserveStockAndCreate(aTransaction()));

      const [reserve, create] = items();
      expect(reserve?.Update).toMatchObject({
        TableName: 'test-products',
        Key: { productId: PRODUCT_ID },
        ConditionExpression:
          'attribute_exists(productId) AND active = :active AND stockAvailable >= :quantity',
        ExpressionAttributeValues: { ':quantity': 1, ':active': true, ':one': 1 },
        ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
      });
      expect(reserve?.Update?.UpdateExpression).toContain(
        'stockReserved = stockReserved + :quantity',
      );
      expect(create?.Put).toMatchObject({
        TableName: 'test-transactions',
        Item: { transactionId: TRANSACTION_ID, status: 'PENDING', pendingBucket: 'PENDING' },
        ConditionExpression: 'attribute_not_exists(transactionId)',
      });
    });

    it('reports the units left when another buyer took them', async () => {
      dynamo.on(TransactWriteCommand).rejects(
        cancelled(
          {
            Code: 'ConditionalCheckFailed',
            Item: { active: { BOOL: true }, stockAvailable: { N: '2' } },
          },
          { Code: 'None' },
        ),
      );

      const result = await unitOfWork.reserveStockAndCreate(aTransaction());

      expect(result.isErr && result.error).toMatchObject({
        code: 'INSUFFICIENT_STOCK',
        context: { availableUnits: 2 },
      });
    });

    it.each([
      ['a product that no longer exists', undefined],
      ['an inactive product', { active: { BOOL: false }, stockAvailable: { N: '9' } }],
    ])('reports %s as not found', async (_case, item) => {
      dynamo
        .on(TransactWriteCommand)
        .rejects(cancelled({ Code: 'ConditionalCheckFailed', Item: item }));

      const result = await unitOfWork.reserveStockAndCreate(aTransaction());

      expect(result.isErr && result.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it.each([
      [
        'a transaction id collision',
        cancelled({ Code: 'None' }, { Code: 'ConditionalCheckFailed' }),
      ],
      ['any other failure', new Error('throttled')],
    ])('reports %s as a persistence error', async (_case, failure) => {
      dynamo.on(TransactWriteCommand).rejects(failure);

      const result = await unitOfWork.reserveStockAndCreate(aTransaction());

      expect(result.isErr && result.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('approveAndAssignDelivery', () => {
    const approve = () => {
      const now = new Date('2026-09-24T20:16:03.000Z');
      const claimed = aTransaction().claimPayment('attempt-1', 1, now);
      const settlement = claimed.settle(aProviderPayment(), now, 'delivery-1');
      if (settlement.kind !== 'settled') {
        throw new Error('Expected a settled transaction');
      }
      const approved = settlement.transaction;
      return { approved, delivery: Delivery.assignFor(approved, 'delivery-1', now) };
    };

    it('approves, turns the reserved units into sold ones and creates the delivery together', async () => {
      dynamo.on(TransactWriteCommand).resolves({});
      const { approved, delivery } = approve();

      expect(unwrap(await unitOfWork.approveAndAssignDelivery(approved, delivery))).toBe('applied');

      const [transaction, product, created] = items();
      expect(transaction?.Update).toMatchObject({
        ConditionExpression: '#status = :pending',
        ExpressionAttributeValues: {
          ':status': 'APPROVED',
          ':deliveryId': 'delivery-1',
          ':payment': { attemptId: 'attempt-1', providerStatus: 'APPROVED', cardLastFour: '4242' },
        },
      });
      expect(transaction?.Update?.UpdateExpression).toContain(
        'payment = :payment, deliveryId = :deliveryId',
      );
      expect(product?.Update?.UpdateExpression).toContain('stockSold = stockSold + :quantity');
      expect(created?.Put).toMatchObject({
        TableName: 'test-deliveries',
        Item: {
          deliveryId: 'delivery-1',
          transactionId: TRANSACTION_ID,
          status: 'ASSIGNED',
          estimatedDeliveryDate: '2026-09-25',
          deliveryFeeInCents: 800_000,
          shippingAddress: { cityCode: '11001', addressLine2: 'Apto 501, Torre 2' },
        },
        ConditionExpression: 'attribute_not_exists(deliveryId)',
      });
    });

    it('reports that another path already settled the transaction', async () => {
      dynamo.on(TransactWriteCommand).rejects(cancelled({ Code: 'ConditionalCheckFailed' }));
      const { approved, delivery } = approve();

      expect(unwrap(await unitOfWork.approveAndAssignDelivery(approved, delivery))).toBe(
        'already-final',
      );
    });
  });

  describe('closeAndReleaseStock', () => {
    const cancelledTransaction = () =>
      unwrap(aTransaction().cancel(new Date('2026-09-24T20:20:00.000Z')));

    it('closes the pending transaction and returns its units to stock', async () => {
      dynamo.on(TransactWriteCommand).resolves({});

      expect(unwrap(await unitOfWork.closeAndReleaseStock(cancelledTransaction()))).toBe('applied');

      const [close, release] = items();
      expect(close?.Update).toMatchObject({
        TableName: 'test-transactions',
        Key: { transactionId: TRANSACTION_ID },
        ConditionExpression: '#status = :pending AND attribute_not_exists(payment)',
        ExpressionAttributeValues: {
          ':status': 'CANCELLED',
          ':finalizedAt': '2026-09-24T20:20:00.000Z',
          ':pending': 'PENDING',
        },
      });
      expect(close?.Update?.UpdateExpression).toContain('REMOVE pendingBucket, pendingSince');
      expect(release?.Update).toMatchObject({
        TableName: 'test-products',
        ConditionExpression: 'stockReserved >= :quantity',
      });
    });

    it('does not require the payment to be missing when the transaction has one', async () => {
      dynamo.on(TransactWriteCommand).resolves({});
      const declined = aStoredTransaction({
        status: 'DECLINED',
        finalizedAt: null,
        payment: {
          attemptId: 'attempt-1',
          submittedAt: new Date('2026-09-24T20:16:00.000Z'),
          installments: 1,
          providerTransactionId: '15113-1',
          providerStatus: 'DECLINED',
          statusMessage: null,
          cardBrand: 'VISA',
          cardLastFour: '1111',
        },
      });

      await unitOfWork.closeAndReleaseStock(declined);

      expect(items()[0]?.Update).toMatchObject({
        ConditionExpression: '#status = :pending',
        ExpressionAttributeValues: { ':finalizedAt': declined.updatedAt.toISOString() },
      });
    });

    it('reports that another path already closed the transaction', async () => {
      dynamo
        .on(TransactWriteCommand)
        .rejects(cancelled({ Code: 'ConditionalCheckFailed' }, { Code: 'None' }));

      expect(unwrap(await unitOfWork.closeAndReleaseStock(cancelledTransaction()))).toBe(
        'already-final',
      );
    });

    it('reports stock that does not add up as a persistence error', async () => {
      dynamo
        .on(TransactWriteCommand)
        .rejects(cancelled({ Code: 'None' }, { Code: 'ConditionalCheckFailed' }));

      const result = await unitOfWork.closeAndReleaseStock(cancelledTransaction());

      expect(result.isErr && result.error.operation).toBe('transactions.closeAndReleaseStock');
    });
  });
});
