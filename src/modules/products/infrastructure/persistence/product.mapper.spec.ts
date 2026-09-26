import { aProductItem } from '../../../../../test/builders/product-item.builder';
import { unwrap } from '../../../../../test/builders/unwrap';
import { PersistenceError } from '../../../../shared/domain/persistence-error';

import { toProduct } from './product.mapper';

describe('toProduct', () => {
  it('maps a table item into a product', () => {
    const product = unwrap(toProduct(aProductItem({ stockAvailable: 24, stockSold: 6 })));

    expect(product).toMatchObject({
      id: '7b1c6f0e-3a2d-4f7e-9c1a-2d4b5e6f7a8b',
      sku: 'TEC-CBL-USBC',
      weightGrams: 60,
      active: true,
      displayOrder: 1,
      updatedAt: new Date('2026-09-24T20:15:00.000Z'),
    });
    expect(product.price.toJSON()).toEqual({ amountInCents: 3_990_000, currency: 'COP' });
    expect(product.stock).toMatchObject({ available: 24, reserved: 0, sold: 6 });
    expect(product.mainImage.basePath).toBe('/images/products/tec-cbl-usbc');
  });

  it.each([
    ['a missing attribute', { name: undefined }],
    ['a wrong type', { active: 'yes' }],
    ['no images', { images: [] }],
    ['an unknown image format', { images: [{ ...imageOf(aProductItem()), formats: ['gif'] }] }],
    ['an invalid date', { updatedAt: 'yesterday' }],
    ['a fractional price', { priceInCents: 10.5 }],
    ['an unsupported currency', { currency: 'USD' }],
    ['a negative stock counter', { stockReserved: -1 }],
    ['a non-positive weight', { weightGrams: 0 }],
    ['no display order', { displayOrder: undefined }],
    ['a negative display order', { displayOrder: -1 }],
  ])('reports corrupt items with %s as persistence errors', (_case, overrides) => {
    const result = toProduct(aProductItem(overrides));

    expect(result.isErr && result.error).toBeInstanceOf(PersistenceError);
    expect(result.isErr && result.error.operation).toBe('products.toDomain');
  });
});

function imageOf(item: Record<string, unknown>): Record<string, unknown> {
  const [image] = item.images as Record<string, unknown>[];
  return { ...image };
}
