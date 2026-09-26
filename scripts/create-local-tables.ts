import { loadAppConfig } from '../src/config/app-config';
import { productsTableDefinition } from '../src/modules/products/infrastructure/persistence/products-table.definition';
import { createTables } from '../src/shared/infrastructure/persistence/create-tables';
import { createDynamoDbClient } from '../src/shared/infrastructure/persistence/dynamodb-client.factory';

const main = async (): Promise<void> => {
  const config = loadAppConfig(process.env);

  if (!config.dynamodbEndpoint) {
    throw new Error(
      'DYNAMODB_ENDPOINT is not set. This script only targets DynamoDB Local; AWS tables are managed by Terraform.',
    );
  }

  const outcomes = await createTables(createDynamoDbClient(config), [
    productsTableDefinition(config.tables.products),
  ]);

  for (const [table, outcome] of outcomes) {
    console.log(`${table}: ${outcome}`);
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
