import { anImage, aProduct, aStock, productProps } from '../../../../test/builders/product.builder';

import type { CatalogPolicy } from './catalog-policy';
import { Product } from './product.entity';

const policy: CatalogPolicy = { lowStockThreshold: 3, maxUnitsPerOrder: 5 };

describe('Product', () => {
  it('uses the first image as the main image', () => {
    const product = aProduct({
      images: [anImage({ alt: 'Front' }), anImage({ alt: 'Side' })],
    });

    expect(product.mainImage.alt).toBe('Front');
  });

  it('derives the stock status from the catalog policy', () => {
    expect(aProduct({ stock: aStock({ available: 2 }) }).stockStatus(policy)).toBe('LOW_STOCK');
  });

  it.each([
    [30, 5],
    [5, 5],
    [2, 2],
    [0, 0],
  ])('with %i available units allows up to %i per order', (available, maxUnits) => {
    expect(aProduct({ stock: aStock({ available }) }).maxUnitsPerOrder(policy)).toBe(maxUnits);
  });

  it.each([0, -10, 12.5])('rejects a weight of %p grams', (weightGrams) => {
    const result = Product.create(productProps({ weightGrams }));

    expect(result.isErr && result.error.fieldErrors[0]?.field).toBe('weightGrams');
  });

  it.each([-1, 1.5])('rejects a display order of %p', (displayOrder) => {
    const result = Product.create(productProps({ displayOrder }));

    expect(result.isErr && result.error.fieldErrors[0]?.field).toBe('displayOrder');
  });
});
