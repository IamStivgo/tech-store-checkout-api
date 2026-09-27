import { UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import type { Currency } from '../../../../shared/domain/money.vo';

import type { ProductSeed } from './product-seed.schema';

const CATALOG_CURRENCY: Currency = 'COP';
const INITIAL_VERSION = 1;

export interface SeedOptions {
  /** Overwrites the stock counters of existing products with the seed values. */
  readonly resetStock: boolean;
  readonly now: Date;
}

type Attributes = Record<string, unknown>;

const assignments = (attributes: Attributes, ifMissing: boolean): string[] =>
  Object.keys(attributes).map((key) =>
    ifMissing ? `#${key} = if_not_exists(#${key}, :${key})` : `#${key} = :${key}`,
  );

const attributeNames = (attributes: Attributes): Record<string, string> =>
  Object.fromEntries(Object.keys(attributes).map((key) => [`#${key}`, key]));

const attributeValues = (attributes: Attributes): Attributes =>
  Object.fromEntries(Object.entries(attributes).map(([key, value]) => [`:${key}`, value]));

/**
 * Upserts the catalog with one UpdateItem per product. Catalog data is always refreshed;
 * stock is only written for new products (or with resetStock), so purchases survive re-seeding.
 */
export class ProductSeeder {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async seed(products: readonly ProductSeed[], options: SeedOptions): Promise<number> {
    for (const product of products) {
      await this.client.send(this.upsert(product, options));
    }
    return products.length;
  }

  private upsert(product: ProductSeed, { resetStock, now }: SeedOptions): UpdateCommand {
    const timestamp = now.toISOString();
    const catalog: Attributes = {
      sku: product.sku,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      priceInCents: product.priceInCents,
      currency: CATALOG_CURRENCY,
      weightGrams: product.weightGrams,
      images: product.images,
      active: product.active,
      displayOrder: product.displayOrder,
      updatedAt: timestamp,
    };
    const stock: Attributes = {
      stockAvailable: product.initialStock,
      stockReserved: 0,
      stockSold: 0,
    };
    const creation: Attributes = { createdAt: timestamp, version: INITIAL_VERSION };
    const all = { ...catalog, ...stock, ...creation };

    return new UpdateCommand({
      TableName: this.tableName,
      Key: { productId: product.productId },
      UpdateExpression: `SET ${[
        ...assignments(catalog, false),
        ...assignments(stock, !resetStock),
        ...assignments(creation, true),
      ].join(', ')}`,
      ExpressionAttributeNames: attributeNames(all),
      ExpressionAttributeValues: attributeValues(all),
    });
  }
}
