import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

/** Same key schema and billing mode as the `products` table of the infrastructure repository. */
export const productsTableDefinition = (tableName: string): CreateTableCommandInput => ({
  TableName: tableName,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [{ AttributeName: 'productId', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'productId', KeyType: 'HASH' }],
});
