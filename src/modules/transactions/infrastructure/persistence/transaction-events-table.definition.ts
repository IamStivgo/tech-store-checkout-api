import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

/** Same keys as the append-only `transaction-events` table of the infrastructure repository. */
export const transactionEventsTableDefinition = (tableName: string): CreateTableCommandInput => ({
  TableName: tableName,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'transactionId', AttributeType: 'S' },
    { AttributeName: 'eventKey', AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'transactionId', KeyType: 'HASH' },
    { AttributeName: 'eventKey', KeyType: 'RANGE' },
  ],
});
