import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

/** Same key schema and billing mode as the `deliveries` table of the infrastructure repository. */
export const deliveriesTableDefinition = (tableName: string): CreateTableCommandInput => ({
  TableName: tableName,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [{ AttributeName: 'deliveryId', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'deliveryId', KeyType: 'HASH' }],
});
