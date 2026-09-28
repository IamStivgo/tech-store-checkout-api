import { aCustomer, CUSTOMER_ID } from '../../../../test/builders/customer.builder';
import { aPricingPolicy, aZone, cop } from '../../../../test/builders/pricing.builder';
import { aProduct, aStock } from '../../../../test/builders/product.builder';
import {
  aShippingAddressData,
  aStoredTransaction,
  aTransaction,
  PRODUCT_ID,
  TRANSACTION_ID,
} from '../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../test/builders/unwrap';
import { FakeClock } from '../../../../test/fakes/fake-clock';
import { FakeIdGenerator } from '../../../../test/fakes/fake-id-generator';
import { InMemoryCheckoutStore } from '../../../../test/fakes/in-memory-checkout.store';
import { InMemoryCoverageRepository } from '../../../../test/fakes/in-memory-coverage.repository';
import { InMemoryCustomerRepository } from '../../../../test/fakes/in-memory-customer.repository';
import { InMemoryProductRepository } from '../../../../test/fakes/in-memory-product.repository';
import { PersistenceError } from '../../../shared/domain/persistence-error';
import type { City } from '../../coverage/domain/location';
import { CheckoutPricingService } from '../../pricing/domain/checkout-pricing.service';
import { DeliveryFeeCalculator } from '../../pricing/domain/delivery-fee.calculator';

import { CancelTransaction } from './cancel-transaction.use-case';
import { CreateTransaction, type CreateTransactionCommand } from './create-transaction.use-case';
import { GetTransaction } from './get-transaction.use-case';

const NOW = new Date('2026-09-24T20:15:00.000Z');
const BOGOTA: City = {
  code: '11001',
  name: 'Bogotá, D.C.',
  departmentCode: '11',
  zone: aZone('LOCAL'),
};
const cable = (overrides: Parameters<typeof aProduct>[0] = {}) =>
  aProduct({ id: PRODUCT_ID, price: cop(39_900), weightGrams: 150, ...overrides });

const command = (overrides: Partial<CreateTransactionCommand> = {}): CreateTransactionCommand => ({
  productId: PRODUCT_ID,
  quantity: 1,
  customerId: CUSTOMER_ID,
  shippingAddress: aShippingAddressData(),
  ...overrides,
});

const setup = ({
  products = new InMemoryProductRepository([cable()]),
  store = new InMemoryCheckoutStore().withStock(PRODUCT_ID, 30),
} = {}) => {
  const policy = aPricingPolicy();
  const createTransaction = new CreateTransaction({
    products,
    customers: new InMemoryCustomerRepository([aCustomer()]),
    coverage: new InMemoryCoverageRepository([BOGOTA]),
    pricing: new CheckoutPricingService(policy, new DeliveryFeeCalculator(policy)),
    checkout: store,
    catalog: { lowStockThreshold: 3, maxUnitsPerOrder: 5 },
    policy: { reservationTtlMinutes: 15, referencePrefix: 'CKT' },
    ids: new FakeIdGenerator([TRANSACTION_ID]),
    clock: new FakeClock(NOW),
  });
  return { store, createTransaction };
};

const errorOf = async (result: PromiseLike<{ isErr: boolean; error?: unknown }>) =>
  ((await result) as { error?: { code: string; context?: unknown } }).error;

describe('CreateTransaction', () => {
  it('creates a PENDING transaction with the amounts computed on the server (E1)', async () => {
    const { store, createTransaction } = setup();

    const transaction = unwrap(await createTransaction.execute(command()));

    expect(transaction.status).toBe('PENDING');
    expect(transaction.id).toBe(TRANSACTION_ID);
    expect(transaction.reference).toBe('CKT-20260924-AAAAAAAAAA');
    expect(transaction.amounts).toEqual({
      productAmount: cop(39_900),
      serviceFee: cop(3_000),
      deliveryFee: cop(8_000),
      total: cop(50_900),
    });
    expect(transaction.delivery).toEqual({
      zone: 'LOCAL',
      billableWeightKg: 1,
      estimatedBusinessDays: { min: 1, max: 1 },
    });
    expect(transaction.product).toMatchObject({ sku: 'TEC-CBL-USBC', unitPrice: cop(39_900) });
    expect(transaction.reservationExpiresAt).toEqual(new Date('2026-09-24T20:30:00.000Z'));
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 29, reserved: 1, sold: 0 });
  });

  it('validates the delivery address before anything else', async () => {
    const { createTransaction } = setup();

    const error = await errorOf(
      createTransaction.execute(
        command({ productId: 'unknown', shippingAddress: aShippingAddressData({ cityCode: '1' }) }),
      ),
    );

    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['an unknown product', command({ productId: 'unknown' }), 'PRODUCT_NOT_FOUND'],
    ['more units than allowed per order', command({ quantity: 6 }), 'QUANTITY_LIMIT_EXCEEDED'],
    ['an unknown customer', command({ customerId: 'unknown' }), 'CUSTOMER_NOT_FOUND'],
    [
      'a city outside the coverage',
      command({ shippingAddress: aShippingAddressData({ cityCode: '99999' }) }),
      'CITY_NOT_SUPPORTED',
    ],
    [
      'a city of another department',
      command({ shippingAddress: aShippingAddressData({ departmentCode: '05' }) }),
      'CITY_NOT_SUPPORTED',
    ],
  ])('rejects %s', async (_case, request, code) => {
    const { store, createTransaction } = setup();

    expect((await errorOf(createTransaction.execute(request)))?.code).toBe(code);
    expect(store.transactions.size).toBe(0);
  });

  it('limits the quantity to the units in stock', async () => {
    const { createTransaction } = setup({
      products: new InMemoryProductRepository([cable({ stock: aStock({ available: 2 }) })]),
    });

    expect(await errorOf(createTransaction.execute(command({ quantity: 3 })))).toMatchObject({
      code: 'QUANTITY_LIMIT_EXCEEDED',
      context: { maxUnitsPerOrder: 2 },
    });
  });

  it('reports that another buyer took the units while ordering', async () => {
    const { store, createTransaction } = setup({
      store: new InMemoryCheckoutStore().withStock(PRODUCT_ID, 1),
    });

    expect(await errorOf(createTransaction.execute(command({ quantity: 2 })))).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      context: { availableUnits: 1 },
    });
    expect(store.transactions.size).toBe(0);
  });

  it('reports storage failures', async () => {
    const { createTransaction } = setup({
      store: new InMemoryCheckoutStore().failWith(new PersistenceError('test', new Error('down'))),
    });

    expect((await errorOf(createTransaction.execute(command())))?.code).toBe('INTERNAL_ERROR');
  });
});

describe('GetTransaction', () => {
  it('returns a stored transaction', async () => {
    const store = new InMemoryCheckoutStore();
    store.transactions.set(TRANSACTION_ID, aTransaction());

    expect(unwrap(await new GetTransaction(store).execute(TRANSACTION_ID)).reference).toBe(
      'CKT-20260924-7K3M9Q2PXA',
    );
  });

  it('reports a missing transaction', async () => {
    const result = await new GetTransaction(new InMemoryCheckoutStore()).execute(TRANSACTION_ID);

    expect(result.isErr && result.error.code).toBe('TRANSACTION_NOT_FOUND');
  });
});

describe('CancelTransaction', () => {
  const later = new FakeClock(new Date('2026-09-24T20:20:00.000Z'));
  const withPending = () => {
    const store = new InMemoryCheckoutStore().withStock(PRODUCT_ID, 29);
    store.stock.set(PRODUCT_ID, { available: 29, reserved: 1, sold: 0 });
    store.transactions.set(TRANSACTION_ID, aTransaction());
    return store;
  };

  it('cancels the transaction and returns its units to stock', async () => {
    const store = withPending();

    const cancelled = unwrap(
      await new CancelTransaction(store, store, later).execute(TRANSACTION_ID),
    );

    expect(cancelled.status).toBe('CANCELLED');
    expect(store.transactions.get(TRANSACTION_ID)?.status).toBe('CANCELLED');
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 30, reserved: 0, sold: 0 });
  });

  it('refuses a transaction that is already final', async () => {
    const store = new InMemoryCheckoutStore();
    store.transactions.set(TRANSACTION_ID, aStoredTransaction({ status: 'DECLINED' }));

    const result = await new CancelTransaction(store, store, later).execute(TRANSACTION_ID);

    expect(result.isErr && result.error.code).toBe('TRANSACTION_NOT_CANCELLABLE');
  });

  it('reports the real state when another path closed it first', async () => {
    const store = withPending();
    const approved = aStoredTransaction({ status: 'APPROVED' });
    jest.spyOn(store, 'closeAndReleaseStock').mockImplementationOnce(() => {
      store.transactions.set(TRANSACTION_ID, approved);
      return new InMemoryCheckoutStore().closeAndReleaseStock(approved);
    });

    const result = await new CancelTransaction(store, store, later).execute(TRANSACTION_ID);

    expect(result.isErr && result.error).toMatchObject({
      code: 'TRANSACTION_NOT_CANCELLABLE',
      context: { status: 'APPROVED' },
    });
  });

  it('reports a missing transaction', async () => {
    const store = new InMemoryCheckoutStore();

    const result = await new CancelTransaction(store, store, later).execute(TRANSACTION_ID);

    expect(result.isErr && result.error.code).toBe('TRANSACTION_NOT_FOUND');
  });
});
