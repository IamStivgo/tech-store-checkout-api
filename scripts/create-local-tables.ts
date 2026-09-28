import { loadAppConfig } from '../src/config/app-config';
import { customersTableDefinition } from '../src/modules/customers/infrastructure/persistence/customers-table.definition';
import { deliveriesTableDefinition } from '../src/modules/deliveries/infrastructure/persistence/deliveries-table.definition';
import { productsTableDefinition } from '../src/modules/products/infrastructure/persistence/products-table.definition';
import { transactionsTableDefinition } from '../src/modules/transactions/infrastructure/persistence/transactions-table.definition';
import { createTables } from '../src/shared/infrastructure/persistence/create-tables';
import { createDynamoDbClient } from '../src/shared/infrastructure/persistence/dynamodb-client.factory';
import { idempotencyKeysTableDefinition } from '../src/shared/infrastructure/persistence/idempotency-keys-table.definition';

const main = async (): Promise<void> => {
  const config = loadAppConfig(process.env);

  if (!config.dynamodbEndpoint) {
    throw new Error(
      'DYNAMODB_ENDPOINT is not set. This script only targets DynamoDB Local; AWS tables are managed by Terraform.',
    );
  }

  const outcomes = await createTables(createDynamoDbClient(config), [
    productsTableDefinition(config.tables.products),
    customersTableDefinition(config.tables.customers),
    transactionsTableDefinition(config.tables.transactions),
    deliveriesTableDefinition(config.tables.deliveries),
    idempotencyKeysTableDefinition(config.tables.idempotency),
  ]);

  for (const [table, outcome] of outcomes) {
    console.log(`${table}: ${outcome}`);
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
