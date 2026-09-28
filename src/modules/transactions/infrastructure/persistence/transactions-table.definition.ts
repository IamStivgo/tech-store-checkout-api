import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

export const REFERENCE_INDEX = 'reference-index';
export const PENDING_INDEX = 'pending-index';

/** Same keys and indexes as the `transactions` table of the infrastructure repository. */
export const transactionsTableDefinition = (tableName: string): CreateTableCommandInput => ({
  TableName: tableName,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'transactionId', AttributeType: 'S' },
    { AttributeName: 'reference', AttributeType: 'S' },
    { AttributeName: 'pendingBucket', AttributeType: 'S' },
    { AttributeName: 'pendingSince', AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'transactionId', KeyType: 'HASH' }],
  GlobalSecondaryIndexes: [
    {
      IndexName: REFERENCE_INDEX,
      KeySchema: [{ AttributeName: 'reference', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: PENDING_INDEX,
      KeySchema: [
        { AttributeName: 'pendingBucket', KeyType: 'HASH' },
        { AttributeName: 'pendingSince', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
});
