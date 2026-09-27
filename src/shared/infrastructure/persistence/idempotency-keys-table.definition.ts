import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

/** Same key schema and billing mode as the `idempotency-keys` table of the infrastructure repository. */
export const idempotencyKeysTableDefinition = (tableName: string): CreateTableCommandInput => ({
  TableName: tableName,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [{ AttributeName: 'idempotencyKey', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'idempotencyKey', KeyType: 'HASH' }],
});
