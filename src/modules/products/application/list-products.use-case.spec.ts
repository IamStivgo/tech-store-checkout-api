import { aProduct, aStock } from '../../../../test/builders/product.builder';
import { unwrap } from '../../../../test/builders/unwrap';
import { InMemoryProductRepository } from '../../../../test/fakes/in-memory-product.repository';
import { PersistenceError } from '../../../shared/domain/persistence-error';

import { ListProducts } from './list-products.use-case';

const policy = { lowStockThreshold: 3, maxUnitsPerOrder: 5 };

describe('ListProducts', () => {
  it('lists only active products with their stock status and main image', async () => {
    const cable = aProduct({ id: 'cable', stock: aStock({ available: 2 }) });
    const hidden = aProduct({ id: 'hidden', active: false });
    const listProducts = new ListProducts(new InMemoryProductRepository([cable, hidden]), policy);

    const products = unwrap(await listProducts.execute());

    expect(products).toEqual([
      {
        id: 'cable',
        sku: cable.sku,
        name: cable.name,
        shortDescription: cable.shortDescription,
        price: cable.price,
        stock: { available: 2, status: 'LOW_STOCK' },
        image: cable.mainImage,
      },
    ]);
  });

  it('sorts the catalog by display order, then by SKU, whatever the storage order', async () => {
    const products = [
      aProduct({ id: 'third', sku: 'TEC-C', displayOrder: 2 }),
      aProduct({ id: 'second', sku: 'TEC-B', displayOrder: 1 }),
      aProduct({ id: 'first', sku: 'TEC-A', displayOrder: 1 }),
      aProduct({ id: 'zero', sku: 'TEC-Z', displayOrder: 0 }),
    ];
    const listProducts = new ListProducts(new InMemoryProductRepository(products), policy);

    const ids = unwrap(await listProducts.execute()).map((product) => product.id);

    expect(ids).toEqual(['zero', 'first', 'second', 'third']);
  });

  it('returns an empty list when there are no active products', async () => {
    const listProducts = new ListProducts(new InMemoryProductRepository(), policy);

    expect(unwrap(await listProducts.execute())).toEqual([]);
  });

  it('propagates persistence failures', async () => {
    const failure = new PersistenceError('products.findAllActive', new Error('timeout'));
    const listProducts = new ListProducts(
      new InMemoryProductRepository().failWith(failure),
      policy,
    );

    const result = await listProducts.execute();

    expect(result.isErr && result.error).toBe(failure);
  });
});
