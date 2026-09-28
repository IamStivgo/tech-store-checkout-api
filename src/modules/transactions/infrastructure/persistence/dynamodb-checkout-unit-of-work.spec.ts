import {
  DynamoDBClient,
  TransactionCanceledException,
  type CancellationReason,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import {
  aStoredTransaction,
  aTransaction,
  PRODUCT_ID,
  TRANSACTION_ID,
} from '../../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../../test/builders/unwrap';

import { DynamoDbCheckoutUnitOfWork } from './dynamodb-checkout-unit-of-work';

const TABLES = { products: 'test-products', transactions: 'test-transactions' };
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
