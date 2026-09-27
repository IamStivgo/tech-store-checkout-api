import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadDynamoDbConnection } from '../src/config/app-config';
import { parseCatalogSeed } from '../src/modules/products/infrastructure/seed/product-seed.schema';
import { ProductSeeder } from '../src/modules/products/infrastructure/seed/product-seeder';
import { createDynamoDbDocumentClient } from '../src/shared/infrastructure/persistence/dynamodb-client.factory';

const SEED_FILE = join(__dirname, '..', 'seed', 'products.json');

const main = async (): Promise<void> => {
  const resetStock = process.argv.includes('--reset-stock');
  // Only the products table: the seed role cannot read any other deploy parameter.
  const tableName = process.env.TABLE_PRODUCTS?.trim();
  if (!tableName) {
    throw new Error('TABLE_PRODUCTS is required');
  }
  const products = parseCatalogSeed(JSON.parse(readFileSync(SEED_FILE, 'utf8')));

  const seeder = new ProductSeeder(
    createDynamoDbDocumentClient(loadDynamoDbConnection(process.env)),
    tableName,
  );
  const count = await seeder.seed(products, { resetStock, now: new Date() });

  console.log(`Seeded ${count} products into ${tableName}${resetStock ? ' (stock reset)' : ''}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
