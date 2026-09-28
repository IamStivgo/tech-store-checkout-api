import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
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
});
