import { aPricingPolicy, aZone, cop } from '../../../../test/builders/pricing.builder';
import { aProduct, aStock } from '../../../../test/builders/product.builder';
import { FakeClock } from '../../../../test/fakes/fake-clock';
import { InMemoryCoverageRepository } from '../../../../test/fakes/in-memory-coverage.repository';
import { InMemoryProductRepository } from '../../../../test/fakes/in-memory-product.repository';
import { PersistenceError } from '../../../shared/domain/persistence-error';
import type { City } from '../../coverage/domain/location';
import type { CatalogPolicy } from '../../products/domain/catalog-policy';
import { CheckoutPricingService } from '../domain/checkout-pricing.service';
import { DeliveryFeeCalculator } from '../domain/delivery-fee.calculator';

import { QuoteCheckout, type QuoteCheckoutCommand } from './quote-checkout.use-case';

const NOW = new Date('2026-09-24T20:15:00.000Z');
const MONITOR_ARM_ID = '0b9a1c47-5e8d-4f2a-b3c6-7d8e9f0a1b2c';
const MEDELLIN: City = {
  code: '05001',
  name: 'Medellín',
  departmentCode: '05',
  zone: aZone('NATIONAL_MAIN'),
};
const catalog: CatalogPolicy = { lowStockThreshold: 3, maxUnitsPerOrder: 5 };

const monitorArm = (overrides: Parameters<typeof aProduct>[0] = {}) =>
  aProduct({ id: MONITOR_ARM_ID, price: cop(139_900), weightGrams: 3_200, ...overrides });

const quoteCheckout = (products = new InMemoryProductRepository([monitorArm()])) => {
  const policy = aPricingPolicy();
  return new QuoteCheckout(
    products,
    new InMemoryCoverageRepository([MEDELLIN]),
    new CheckoutPricingService(policy, new DeliveryFeeCalculator(policy)),
    catalog,
    new FakeClock(NOW),
  );
};

const command = (overrides: Partial<QuoteCheckoutCommand> = {}): QuoteCheckoutCommand => ({
  productId: MONITOR_ARM_ID,
  quantity: 1,
  cityCode: '05001',
  ...overrides,
});

const errorOf = async (result: ReturnType<QuoteCheckout['execute']>) =>
  (await result).match({ ok: () => undefined, err: (error) => error });

describe('QuoteCheckout', () => {
  it('quotes the order with the current price and the zone of the city (example E2)', async () => {
    const quote = (await quoteCheckout().execute(command())).match({
      ok: (value) => value,
      err: (error) => {
        throw new Error(error.detail);
      },
    });

    expect(quote).toMatchObject({
      productId: MONITOR_ARM_ID,
      quantity: 1,
      productAmount: cop(139_900),
      deliveryFee: cop(17_500),
      total: cop(160_400),
      delivery: { zone: 'NATIONAL_MAIN', billableWeightKg: 4 },
      calculatedAt: NOW,
    });
  });

  it('accepts up to the order limit when there is enough stock', async () => {
    const result = await quoteCheckout().execute(command({ quantity: 5 }));

    expect(result.isOk).toBe(true);
  });

  it('rejects more units than the order limit', async () => {
    const error = await errorOf(quoteCheckout().execute(command({ quantity: 6 })));

    expect(error).toMatchObject({
      code: 'QUANTITY_LIMIT_EXCEEDED',
      context: { maxUnitsPerOrder: 5 },
    });
  });

  it('limits the quantity to the available stock when it is lower', async () => {
    const products = new InMemoryProductRepository([
      monitorArm({ stock: aStock({ available: 2 }) }),
    ]);

    const error = await errorOf(quoteCheckout(products).execute(command({ quantity: 3 })));

    expect(error).toMatchObject({
      code: 'QUANTITY_LIMIT_EXCEEDED',
      context: { maxUnitsPerOrder: 2 },
    });
  });

  it.each([
    ['unknown', new InMemoryProductRepository([])],
    ['inactive', new InMemoryProductRepository([monitorArm({ active: false })])],
  ])('reports an %s product as not found', async (_case, products) => {
    const error = await errorOf(quoteCheckout(products).execute(command()));

    expect(error?.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects cities outside the coverage', async () => {
    const error = await errorOf(quoteCheckout().execute(command({ cityCode: '99999' })));

    expect(error?.code).toBe('CITY_NOT_SUPPORTED');
  });

  it('reports persistence failures', async () => {
    const failure = new PersistenceError('products.findById', new Error('timeout'));
    const products = new InMemoryProductRepository().failWith(failure);

    const error = await errorOf(quoteCheckout(products).execute(command()));

    expect(error).toBe(failure);
  });
});
