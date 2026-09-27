import {
  Product,
  type ProductImage,
  type ProductProps,
} from '../../src/modules/products/domain/product.entity';
import { Stock, type StockCounters } from '../../src/modules/products/domain/stock.vo';
import { Money } from '../../src/shared/domain/money.vo';

import { unwrap } from './unwrap';

export const aStock = (counters: Partial<StockCounters> = {}): Stock =>
  unwrap(Stock.create({ available: 30, reserved: 0, sold: 0, ...counters }));

export const anImage = (overrides: Partial<ProductImage> = {}): ProductImage => ({
  basePath: '/images/products/tec-cbl-usbc',
  alt: 'Cable USB-C trenzado de 2 metros enrollado',
  width: 640,
  height: 640,
  formats: ['avif', 'webp', 'jpg'],
  ...overrides,
});

export const productProps = (overrides: Partial<ProductProps> = {}): ProductProps => ({
  id: '7b1c6f0e-3a2d-4f7e-9c1a-2d4b5e6f7a8b',
  sku: 'TEC-CBL-USBC',
  name: 'Cable USB-C a USB-C 2 m (100 W)',
  shortDescription: 'Carga rápida de hasta 100 W y transferencia de datos USB 2.0.',
  description: 'Cable trenzado de 2 metros con conectores USB-C en ambos extremos.',
  price: unwrap(Money.create(3_990_000)),
  stock: aStock(),
  weightGrams: 60,
  images: [anImage()],
  active: true,
  displayOrder: 1,
  updatedAt: new Date('2026-09-24T20:15:00.000Z'),
  ...overrides,
});

export const aProduct = (overrides: Partial<ProductProps> = {}): Product =>
  unwrap(Product.create(productProps(overrides)));
