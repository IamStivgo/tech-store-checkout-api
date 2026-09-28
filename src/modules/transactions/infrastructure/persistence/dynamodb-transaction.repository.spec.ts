import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import { aTransaction, TRANSACTION_ID } from '../../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../../test/builders/unwrap';

import { DynamoDbTransactionRepository } from './dynamodb-transaction.repository';
import { toTransactionItem } from './transaction.mapper';

const TABLE = 'checkout-app-test-transactions';

describe('DynamoDbTransactionRepository', () => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
  const dynamo = mockClient(client);
  const repository = new DynamoDbTransactionRepository(client, TABLE);

  beforeEach(() => {
    dynamo.reset();
  });

  it('reads the transaction consistently by its key', async () => {
    dynamo.on(GetCommand).resolves({ Item: toTransactionItem(aTransaction()) });

    expect(unwrap(await repository.findById(TRANSACTION_ID))?.reference).toBe(
      'CKT-20260924-7K3M9Q2PXA',
    );
    expect(dynamo.commandCalls(GetCommand)[0]?.args[0].input).toEqual({
      TableName: TABLE,
      Key: { transactionId: TRANSACTION_ID },
      ConsistentRead: true,
    });
  });

  it('returns null when the transaction does not exist', async () => {
    dynamo.on(GetCommand).resolves({});

    expect(unwrap(await repository.findById(TRANSACTION_ID))).toBeNull();
  });

  it('wraps SDK failures in a persistence error', async () => {
    dynamo.on(GetCommand).rejects(new Error('timeout'));

    const result = await repository.findById(TRANSACTION_ID);

    expect(result.isErr && result.error.operation).toBe('transactions.findById');
  });

  it('reads the oldest pending transactions from the sparse pending index', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [toTransactionItem(aTransaction())] });

    const pending = unwrap(await repository.findPending(50));

    expect(pending.map(({ id }) => id)).toEqual([TRANSACTION_ID]);
    expect(dynamo.commandCalls(QueryCommand)[0]?.args[0].input).toEqual({
      TableName: TABLE,
      IndexName: 'pending-index',
      KeyConditionExpression: 'pendingBucket = :bucket',
      ExpressionAttributeValues: { ':bucket': 'PENDING' },
      ScanIndexForward: true,
      Limit: 50,
    });
  });

  it('reports a failed query of the pending transactions', async () => {
    dynamo.on(QueryCommand).rejects(new Error('throttled'));

    const result = await repository.findPending(50);

    expect(result.isErr && result.error.operation).toBe('transactions.findPending');
  });

  describe('payment claim', () => {
    const NOW = new Date('2026-09-24T20:16:00.000Z');
    const claimed = () => aTransaction().claimPayment('attempt-1', 3, NOW);
    const conditionFailed = () =>
      new ConditionalCheckFailedException({
        message: 'The conditional request failed',
        $metadata: {},
      });
    const update = () => dynamo.commandCalls(UpdateCommand)[0]?.args[0].input;

    it('claims the payment only while PENDING, unpaid and reserved', async () => {
      dynamo.on(UpdateCommand).resolves({});

      unwrap(await repository.claimPaymentSubmission(claimed()));

      expect(update()).toMatchObject({
        Key: { transactionId: TRANSACTION_ID },
        UpdateExpression: 'SET payment = :payment, updatedAt = :now',
        ConditionExpression:
          '#status = :pending AND attribute_not_exists(payment) AND reservationExpiresAt > :now',
        ExpressionAttributeValues: {
          ':payment': { attemptId: 'attempt-1', installments: 3, submittedAt: NOW.toISOString() },
          ':now': NOW.toISOString(),
        },
      });
    });

    it('reports a payment claimed first by another attempt', async () => {
      dynamo.on(UpdateCommand).rejects(conditionFailed());

      const result = await repository.claimPaymentSubmission(claimed());

      expect(result.isErr && result.error.code).toBe('PAYMENT_ALREADY_SUBMITTED');
    });

    it.each([
      ['an SDK failure', () => dynamo.on(UpdateCommand).rejects(new Error('throttled')), claimed],
      ['a transaction without a claimed payment', () => undefined, aTransaction],
    ])('reports %s as a persistence error', async (_case, arrange, transaction) => {
      arrange();

      const result = await repository.claimPaymentSubmission(transaction());

      expect(result.isErr && result.error.code).toBe('INTERNAL_ERROR');
    });

    it('releases only the claim of the same attempt', async () => {
      dynamo.on(UpdateCommand).resolves({});

      unwrap(await repository.releasePaymentClaim(TRANSACTION_ID, 'attempt-1'));

      expect(update()).toMatchObject({
        UpdateExpression: 'REMOVE payment',
        ConditionExpression: 'payment.attemptId = :attemptId',
        ExpressionAttributeValues: { ':attemptId': 'attempt-1' },
      });
    });

    it('records the provider data of its own attempt', async () => {
      dynamo.on(UpdateCommand).resolves({});
      const recorded = claimed().withProviderPayment(
        {
          providerTransactionId: '15113-1',
          reference: 'CKT-20260924-7K3M9Q2PXA',
          status: 'PENDING',
          amount: aTransaction().amounts.total,
          statusMessage: null,
          cardBrand: 'VISA',
          cardLastFour: '4242',
        },
        NOW,
      );

      unwrap(await repository.recordProviderPayment(recorded));

      expect(update()).toMatchObject({
        ConditionExpression: 'payment.attemptId = :attemptId',
        ExpressionAttributeValues: {
          ':payment': { providerTransactionId: '15113-1', providerStatus: 'PENDING' },
          ':attemptId': 'attempt-1',
        },
      });
    });

    it('does nothing to record without a claimed payment', async () => {
      unwrap(await repository.recordProviderPayment(aTransaction()));

      expect(dynamo.commandCalls(UpdateCommand)).toHaveLength(0);
    });

    it('leaves another attempt alone and reports other failures', async () => {
      dynamo.on(UpdateCommand).rejectsOnce(conditionFailed()).rejectsOnce(new Error('throttled'));

      expect((await repository.releasePaymentClaim(TRANSACTION_ID, 'attempt-1')).isOk).toBe(true);
      const failed = await repository.releasePaymentClaim(TRANSACTION_ID, 'attempt-1');
      expect(failed.isErr && failed.error.operation).toBe('transactions.releasePaymentClaim');
    });
  });
});
