import { aProduct, aStock } from '../../../../test/builders/product.builder';
import { unwrap } from '../../../../test/builders/unwrap';
import { InMemoryProductRepository } from '../../../../test/fakes/in-memory-product.repository';
import { ProductNotFoundError } from '../domain/product.errors';

import { GetProductStock } from './get-product-stock.use-case';

const policy = { lowStockThreshold: 3, maxUnitsPerOrder: 5 };

describe('GetProductStock', () => {
  it('returns the available units, the stock status and when it changed', async () => {
    const updatedAt = new Date('2026-09-25T10:00:00.000Z');
    const product = aProduct({ id: 'cable', stock: aStock({ available: 0 }), updatedAt });
    const getProductStock = new GetProductStock(new InMemoryProductRepository([product]), policy);

    expect(unwrap(await getProductStock.execute('cable'))).toEqual({
      productId: 'cable',
      available: 0,
      status: 'OUT_OF_STOCK',
      updatedAt,
    });
  });

  it('answers PRODUCT_NOT_FOUND for unknown products', async () => {
    const getProductStock = new GetProductStock(new InMemoryProductRepository(), policy);

    const result = await getProductStock.execute('unknown');

    expect(result.isErr && result.error).toBeInstanceOf(ProductNotFoundError);
  });
});
