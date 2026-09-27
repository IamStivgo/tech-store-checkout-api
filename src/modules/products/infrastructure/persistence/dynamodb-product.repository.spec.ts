import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import { aProductItem } from '../../../../../test/builders/product-item.builder';
import { unwrap } from '../../../../../test/builders/unwrap';
import { PersistenceError } from '../../../../shared/domain/persistence-error';

import { DynamoDbProductRepository } from './dynamodb-product.repository';

const TABLE = 'checkout-app-test-products';

describe('DynamoDbProductRepository', () => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
  const dynamo = mockClient(client);
  const repository = new DynamoDbProductRepository(client, TABLE);

  beforeEach(() => {
    dynamo.reset();
  });

  describe('findAllActive', () => {
    it('scans only active products in the configured table', async () => {
      dynamo.on(ScanCommand).resolves({ Items: [aProductItem()] });

      const products = unwrap(await repository.findAllActive());

      expect(products.map((product) => product.sku)).toEqual(['TEC-CBL-USBC']);
      expect(dynamo.commandCalls(ScanCommand)[0]?.args[0].input).toMatchObject({
        TableName: TABLE,
        FilterExpression: 'active = :active',
        ExpressionAttributeValues: { ':active': true },
      });
    });

    it('reads every page of the scan', async () => {
      const lastKey = { productId: 'first' };
      dynamo
        .on(ScanCommand)
        .resolvesOnce({ Items: [aProductItem({ productId: 'first' })], LastEvaluatedKey: lastKey })
        .resolvesOnce({ Items: [aProductItem({ productId: 'second' })] });

      const products = unwrap(await repository.findAllActive());

      expect(products.map((product) => product.id)).toEqual(['first', 'second']);
      expect(dynamo.commandCalls(ScanCommand)[1]?.args[0].input.ExclusiveStartKey).toEqual(lastKey);
    });

    it('returns an empty list when the scan has no items', async () => {
      dynamo.on(ScanCommand).resolves({});

      expect(unwrap(await repository.findAllActive())).toEqual([]);
    });

    it('wraps SDK failures in a persistence error', async () => {
      dynamo.on(ScanCommand).rejects(new Error('ProvisionedThroughputExceededException'));

      const result = await repository.findAllActive();

      expect(result.isErr && result.error).toBeInstanceOf(PersistenceError);
      expect(result.isErr && result.error.operation).toBe('products.findAllActive');
    });

    it('fails when an item is corrupt instead of hiding it', async () => {
      dynamo.on(ScanCommand).resolves({ Items: [aProductItem(), aProductItem({ images: [] })] });

      const result = await repository.findAllActive();

      expect(result.isErr && result.error.operation).toBe('products.toDomain');
    });
  });

  describe('findById', () => {
    it('gets the product by its key', async () => {
      dynamo.on(GetCommand).resolves({ Item: aProductItem() });

      const product = unwrap(await repository.findById('7b1c6f0e-3a2d-4f7e-9c1a-2d4b5e6f7a8b'));

      expect(product?.sku).toBe('TEC-CBL-USBC');
      expect(dynamo.commandCalls(GetCommand)[0]?.args[0].input).toEqual({
        TableName: TABLE,
        Key: { productId: '7b1c6f0e-3a2d-4f7e-9c1a-2d4b5e6f7a8b' },
      });
    });

    it('returns null when the product does not exist', async () => {
      dynamo.on(GetCommand).resolves({});

      expect(unwrap(await repository.findById('unknown'))).toBeNull();
    });

    it('wraps SDK failures in a persistence error', async () => {
      dynamo.on(GetCommand).rejects(new Error('ResourceNotFoundException'));

      const result = await repository.findById('any');

      expect(result.isErr && result.error.operation).toBe('products.findById');
    });
  });
});
