import { anImage, aProduct, aStock } from '../../../../test/builders/product.builder';
import { unwrap } from '../../../../test/builders/unwrap';
import { InMemoryProductRepository } from '../../../../test/fakes/in-memory-product.repository';
import { PersistenceError } from '../../../shared/domain/persistence-error';
import { ProductNotFoundError } from '../domain/product.errors';

import { GetProduct } from './get-product.use-case';

const policy = { lowStockThreshold: 3, maxUnitsPerOrder: 5 };

describe('GetProduct', () => {
  it('returns the product detail with every image and the order limit', async () => {
    const images = [anImage({ alt: 'Front' }), anImage({ alt: 'Side' })] as const;
    const product = aProduct({
      id: 'cable',
      stock: aStock({ available: 30 }),
      images: [...images],
    });
    const getProduct = new GetProduct(new InMemoryProductRepository([product]), policy);

    const detail = unwrap(await getProduct.execute('cable'));

    expect(detail).toMatchObject({
      id: 'cable',
      description: product.description,
      weightGrams: product.weightGrams,
      images,
      image: images[0],
      stock: { available: 30, status: 'IN_STOCK' },
      maxUnitsPerOrder: 5,
    });
  });

  it.each([
    ['does not exist', []],
    ['is inactive', [aProduct({ id: 'cable', active: false })]],
  ])('answers PRODUCT_NOT_FOUND when the product %s', async (_case, products) => {
    const getProduct = new GetProduct(new InMemoryProductRepository(products), policy);

    const result = await getProduct.execute('cable');

    expect(result.isErr && result.error).toBeInstanceOf(ProductNotFoundError);
  });

  it('propagates persistence failures', async () => {
    const failure = new PersistenceError('products.findById', new Error('timeout'));
    const getProduct = new GetProduct(new InMemoryProductRepository().failWith(failure), policy);

    const result = await getProduct.execute('cable');

    expect(result.isErr && result.error).toBe(failure);
  });
});
