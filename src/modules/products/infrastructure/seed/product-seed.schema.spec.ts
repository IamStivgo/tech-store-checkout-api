import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseCatalogSeed, type ProductSeed } from './product-seed.schema';

const SEED_FILE = join(__dirname, '../../../../../seed/products.json');

const readSeed = (): unknown => JSON.parse(readFileSync(SEED_FILE, 'utf8')) as unknown;

const validProduct = (overrides: Partial<ProductSeed> = {}): Record<string, unknown> => ({
  productId: '7d094266-0b4e-4789-9522-96e1cd7ffa60',
  sku: 'TEC-CBL-USBC',
  name: 'Cable',
  shortDescription: 'Short',
  description: 'Long',
  priceInCents: 3_990_000,
  weightGrams: 150,
  initialStock: 30,
  displayOrder: 1,
  active: true,
  images: [{ basePath: '/images/products/x', alt: 'x', width: 640, height: 640, formats: ['jpg'] }],
  ...overrides,
});

describe('catalog seed file', () => {
  const seed = parseCatalogSeed(readSeed());

  it('lists the ten products in the order of the approved mockups', () => {
    expect(seed.map((product) => [product.displayOrder, product.sku])).toEqual([
      [1, 'TEC-CBL-USBC'],
      [2, 'TEC-CHG-65W'],
      [3, 'TEC-MSE-ERG'],
      [4, 'TEC-STD-LAP'],
      [5, 'TEC-HUB-7IN1'],
      [6, 'TEC-PWB-20K'],
      [7, 'TEC-ARM-MON'],
      [8, 'TEC-KBD-75'],
      [9, 'TEC-HPH-ANC'],
      [10, 'TEC-SSD-1TB'],
    ]);
  });

  it.each([
    ['TEC-CBL-USBC', 3_990_000, 150, 30],
    ['TEC-CHG-65W', 12_990_000, 200, 14],
    ['TEC-MSE-ERG', 11_990_000, 150, 20],
    ['TEC-STD-LAP', 9_990_000, 1_100, 12],
    ['TEC-HUB-7IN1', 14_990_000, 120, 10],
    ['TEC-PWB-20K', 13_990_000, 450, 3],
    ['TEC-ARM-MON', 13_990_000, 3_200, 7],
    ['TEC-KBD-75', 24_990_000, 900, 6],
    ['TEC-HPH-ANC', 28_990_000, 350, 8],
    ['TEC-SSD-1TB', 35_990_000, 100, 0],
  ])(
    '%s has the price, weight and initial stock of the business rules',
    (sku, price, weight, stock) => {
      expect(seed.find((product) => product.sku === sku)).toMatchObject({
        priceInCents: price,
        weightGrams: weight,
        initialStock: stock,
      });
    },
  );

  it('uses one image per product named after its SKU, in every format', () => {
    for (const product of seed) {
      expect(product.images[0]).toMatchObject({
        basePath: `/images/products/${product.sku.toLowerCase()}`,
        formats: ['avif', 'webp', 'jpg'],
      });
    }
  });
});

describe('parseCatalogSeed', () => {
  it.each([
    ['an invalid UUID', [validProduct({ productId: 'product-1' })]],
    ['a fractional price', [validProduct({ priceInCents: 10.5 })]],
    ['a negative initial stock', [validProduct({ initialStock: -1 })]],
    ['no images', [{ ...validProduct(), images: [] }]],
    ['an empty catalog', []],
  ])('rejects %s', (_case, data) => {
    expect(() => parseCatalogSeed(data)).toThrow();
  });

  it.each([
    ['productId', { sku: 'TEC-OTHER', displayOrder: 2 }],
    ['sku', { productId: '79ab284b-42a1-4b62-b973-10d4c86ba4da', displayOrder: 2 }],
    ['displayOrder', { productId: '79ab284b-42a1-4b62-b973-10d4c86ba4da', sku: 'TEC-OTHER' }],
  ])('rejects a duplicated %s', (field, overrides) => {
    expect(() => parseCatalogSeed([validProduct(), validProduct(overrides)])).toThrow(
      `${field} must be unique`,
    );
  });
});
