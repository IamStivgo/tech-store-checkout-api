import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

/** Same key schema and billing mode as the `customers` table of the infrastructure repository. */
export const customersTableDefinition = (tableName: string): CreateTableCommandInput => ({
  TableName: tableName,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [{ AttributeName: 'customerId', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'customerId', KeyType: 'HASH' }],
});
