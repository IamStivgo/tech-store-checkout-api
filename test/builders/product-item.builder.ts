/** A `products` table item as stored in DynamoDB (data model §3.1). */
export const aProductItem = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  productId: '7b1c6f0e-3a2d-4f7e-9c1a-2d4b5e6f7a8b',
  sku: 'TEC-CBL-USBC',
  name: 'Cable USB-C a USB-C 2 m (100 W)',
  shortDescription: 'Carga rápida de hasta 100 W y transferencia de datos USB 2.0.',
  description: 'Cable trenzado de 2 metros con conectores USB-C en ambos extremos.',
  priceInCents: 3_990_000,
  currency: 'COP',
  stockAvailable: 30,
  stockReserved: 0,
  stockSold: 0,
  weightGrams: 60,
  images: [
    {
      basePath: '/images/products/tec-cbl-usbc',
      alt: 'Cable USB-C trenzado de 2 metros enrollado',
      width: 640,
      height: 640,
      formats: ['avif', 'webp', 'jpg'],
    },
  ],
  active: true,
  version: 1,
  createdAt: '2026-09-24T20:00:00.000Z',
  updatedAt: '2026-09-24T20:15:00.000Z',
  ...overrides,
});
