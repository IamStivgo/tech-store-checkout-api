import { GetCommand, ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { combine, ok, ResultAsync } from '../../../../shared/domain/result';
import type { Product } from '../../domain/product.entity';
import type { ProductRepository } from '../../domain/product.repository.port';

import { toProduct } from './product.mapper';

type Item = Record<string, unknown>;

export class DynamoDbProductRepository implements ProductRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  findAllActive(): ResultAsync<Product[], PersistenceError> {
    return ResultAsync.fromPromise(
      this.scanActiveItems(),
      (cause) => new PersistenceError('products.findAllActive', cause),
    ).andThen((items) => combine(items.map(toProduct)));
  }

  findById(id: string): ResultAsync<Product | null, PersistenceError> {
    return ResultAsync.fromPromise(
      this.client.send(new GetCommand({ TableName: this.tableName, Key: { productId: id } })),
      (cause) => new PersistenceError('products.findById', cause),
    ).andThen(({ Item }) => (Item ? toProduct(Item) : ok(null)));
  }

  /** The catalog is small (AP-01), but Scan pages at 1 MB, so every page is read. */
  private async scanActiveItems(): Promise<Item[]> {
    const items: Item[] = [];
    let exclusiveStartKey: Item | undefined;

    do {
      const page = await this.client.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'active = :active',
          ExpressionAttributeValues: { ':active': true },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      items.push(...(page.Items ?? []));
      exclusiveStartKey = page.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return items;
  }
}
