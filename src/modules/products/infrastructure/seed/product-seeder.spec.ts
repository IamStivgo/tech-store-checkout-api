import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import type { ProductSeed } from './product-seed.schema';
import { ProductSeeder } from './product-seeder';

const TABLE = 'checkout-app-test-products';
const NOW = new Date('2026-09-26T12:00:00.000Z');

const aSeedProduct = (overrides: Partial<ProductSeed> = {}): ProductSeed => ({
  productId: '7d094266-0b4e-4789-9522-96e1cd7ffa60',
  sku: 'TEC-CBL-USBC',
  name: 'Cable USB-C a USB-C 2 m (100 W)',
  shortDescription: 'Carga rápida.',
  description: 'Cable trenzado.',
  priceInCents: 3_990_000,
  weightGrams: 150,
  initialStock: 30,
  displayOrder: 1,
  active: true,
  images: [
    {
      basePath: '/images/products/tec-cbl-usbc',
      alt: 'Cable',
      width: 640,
      height: 640,
      formats: ['avif', 'webp', 'jpg'],
    },
  ],
  ...overrides,
});

describe('ProductSeeder', () => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
  const dynamo = mockClient(client);
  const seeder = new ProductSeeder(client, TABLE);

  const sentUpdates = () => dynamo.commandCalls(UpdateCommand).map((call) => call.args[0].input);

  beforeEach(() => {
    dynamo.reset();
    dynamo.on(UpdateCommand).resolves({});
  });

  it('upserts every product by its id and returns how many were seeded', async () => {
    const count = await seeder.seed(
      [aSeedProduct(), aSeedProduct({ productId: '79ab284b-42a1-4b62-b973-10d4c86ba4da' })],
      { resetStock: false, now: NOW },
    );

    expect(count).toBe(2);
    expect(sentUpdates().map((input) => input.Key)).toEqual([
      { productId: '7d094266-0b4e-4789-9522-96e1cd7ffa60' },
      { productId: '79ab284b-42a1-4b62-b973-10d4c86ba4da' },
    ]);
    expect(sentUpdates()[0]?.TableName).toBe(TABLE);
  });

  it('always refreshes the catalog data, using attribute names for reserved words', async () => {
    await seeder.seed([aSeedProduct()], { resetStock: false, now: NOW });

    const [update] = sentUpdates();
    expect(update?.UpdateExpression).toContain('#name = :name');
    expect(update?.UpdateExpression).toContain('#displayOrder = :displayOrder');
    expect(update?.ExpressionAttributeNames).toMatchObject({ '#name': 'name' });
    expect(update?.ExpressionAttributeValues).toMatchObject({
      ':name': 'Cable USB-C a USB-C 2 m (100 W)',
      ':priceInCents': 3_990_000,
      ':currency': 'COP',
      ':updatedAt': '2026-09-26T12:00:00.000Z',
    });
  });

  it('only sets the stock of new products, so purchases survive a new seed', async () => {
    await seeder.seed([aSeedProduct()], { resetStock: false, now: NOW });

    const [update] = sentUpdates();
    expect(update?.UpdateExpression).toContain(
      '#stockAvailable = if_not_exists(#stockAvailable, :stockAvailable)',
    );
    expect(update?.UpdateExpression).toContain(
      '#stockSold = if_not_exists(#stockSold, :stockSold)',
    );
    expect(update?.ExpressionAttributeValues).toMatchObject({ ':stockAvailable': 30 });
  });

  it('overwrites the stock counters when resetStock is set', async () => {
    await seeder.seed([aSeedProduct()], { resetStock: true, now: NOW });

    const [update] = sentUpdates();
    expect(update?.UpdateExpression).toContain('#stockAvailable = :stockAvailable');
    expect(update?.UpdateExpression).toContain('#stockReserved = :stockReserved');
    expect(update?.UpdateExpression).not.toContain('if_not_exists(#stockAvailable');
  });

  it('keeps the creation date and version of existing products', async () => {
    await seeder.seed([aSeedProduct()], { resetStock: true, now: NOW });

    const [update] = sentUpdates();
    expect(update?.UpdateExpression).toContain(
      '#createdAt = if_not_exists(#createdAt, :createdAt)',
    );
    expect(update?.UpdateExpression).toContain('#version = if_not_exists(#version, :version)');
  });
});
