/** Use cases of the payment together with the fake payment gateway of local runs (ADR-011). */
import {
  PaymentProviderTimeoutError,
  PaymentProviderUnavailableError,
  PaymentRejectedByProviderError,
} from '../../src/modules/payments/domain/payment-gateway.errors';
import { FakePaymentGateway } from '../../src/modules/payments/infrastructure/fake/fake-payment-gateway';
import { ApplyPaymentResult } from '../../src/modules/transactions/application/apply-payment-result.use-case';
import {
  ProcessPayment,
  type ProcessPaymentCommand,
} from '../../src/modules/transactions/application/process-payment.use-case';
import { errAsync, okAsync } from '../../src/shared/domain/result';
import { aCustomer } from '../builders/customer.builder';
import { aZone, cop } from '../builders/pricing.builder';
import { aProviderPayment } from '../builders/provider-payment.builder';
import {
  aStoredTransaction,
  aTransaction,
  PRODUCT_ID,
  TRANSACTION_ID,
} from '../builders/transaction.builder';
import { unwrap } from '../builders/unwrap';
import { FakeClock } from '../fakes/fake-clock';
import { FakeIdGenerator } from '../fakes/fake-id-generator';
import { FakeSleeper } from '../fakes/fake-sleeper';
import { InMemoryCheckoutStore } from '../fakes/in-memory-checkout.store';
import { InMemoryCoverageRepository } from '../fakes/in-memory-coverage.repository';
import { InMemoryCustomerRepository } from '../fakes/in-memory-customer.repository';

const NOW = new Date('2026-09-24T20:16:00.000Z');
const POLL_DELAYS = [1000, 1500, 2000, 2500];
const DELIVERY_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const command = (cardToken = 'tok_fake_approved_4242_1'): ProcessPaymentCommand => ({
  transactionId: TRANSACTION_ID,
  cardToken,
  installments: 3,
  acceptanceToken: 'fake.endUserPolicy.1',
  personalDataAuthToken: 'fake.personalDataAuth.1',
});

const BOGOTA_COVERAGE = new InMemoryCoverageRepository(
  [{ code: '11001', name: 'Bogotá, D.C.', departmentCode: '11', zone: aZone('LOCAL') }],
  [{ code: '11', name: 'Bogotá, D.C.' }],
);

const setup = ({
  transaction = aTransaction(),
  customers = [aCustomer()],
  coverage = BOGOTA_COVERAGE,
} = {}) => {
  const store = new InMemoryCheckoutStore().withStock(PRODUCT_ID, 29);
  store.stock.set(PRODUCT_ID, { available: 29, reserved: 1, sold: 0 });
  store.transactions.set(transaction.id, transaction);
  const gateway = new FakePaymentGateway();
  const sleeper = new FakeSleeper();
  const clock = new FakeClock(NOW);
  const ids = new FakeIdGenerator(['attempt-1', DELIVERY_ID]);
  const processPayment = new ProcessPayment({
    transactions: store,
    customers: new InMemoryCustomerRepository(customers),
    coverage,
    gateway,
    applyResult: new ApplyPaymentResult(store, store, ids, clock),
    ids,
    clock,
    sleeper,
    pollDelaysMs: POLL_DELAYS,
  });
  return { store, gateway, sleeper, processPayment };
};

const errorOf = async (result: PromiseLike<{ isErr: boolean }>) =>
  ((await result) as { error?: { code: string } }).error?.code;

describe('ProcessPayment', () => {
  it('sends the payment, waits for approval, confirms the stock and assigns the delivery', async () => {
    const { store, sleeper, processPayment } = setup();

    const transaction = unwrap(await processPayment.execute(command()));

    expect(transaction.status).toBe('APPROVED');
    expect(transaction.deliveryId).toBe(DELIVERY_ID);
    expect(transaction.payment).toMatchObject({
      attemptId: 'attempt-1',
      installments: 3,
      providerTransactionId: 'fake-1',
      providerStatus: 'APPROVED',
      cardLastFour: '4242',
    });
    expect(store.transactions.get(TRANSACTION_ID)?.status).toBe('APPROVED');
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 29, reserved: 0, sold: 1 });
    expect(store.deliveries.get(DELIVERY_ID)?.props.estimatedDeliveryDate).toBe('2026-09-25');
    expect(sleeper.waits).toEqual([1000]);
  });

  it('declines and returns the reserved units to stock', async () => {
    const { store, processPayment } = setup();

    const transaction = unwrap(await processPayment.execute(command('tok_fake_declined_1111_1')));

    expect(transaction.status).toBe('DECLINED');
    expect(transaction.deliveryId).toBeNull();
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 30, reserved: 0, sold: 0 });
  });

  it('sends the amounts and delivery data of the transaction to the provider', async () => {
    const { gateway, processPayment } = setup();
    const create = jest.spyOn(gateway, 'createCardPayment');

    await processPayment.execute(command());

    expect(create).toHaveBeenCalledWith({
      reference: 'CKT-20260924-7K3M9Q2PXA',
      amount: cop(50_900),
      customerEmail: 'ana.gomez@example.com',
      cardToken: 'tok_fake_approved_4242_1',
      installments: 3,
      endUserPolicyToken: 'fake.endUserPolicy.1',
      personalDataAuthToken: 'fake.personalDataAuth.1',
      customer: {
        fullName: 'Ana María Gómez',
        phone: '3001234567',
        legalIdType: 'CC',
        legalId: '1020304050',
      },
      shippingAddress: {
        recipientName: 'Ana María Gómez',
        phone: '3001234567',
        addressLine1: 'Calle 100 # 10-20',
        addressLine2: 'Apto 501, Torre 2',
        city: 'Bogotá, D.C.',
        region: 'Bogotá, D.C.',
        postalCode: '110111',
      },
    });
  });

  it('answers PENDING when the provider has no final result after about 8 seconds', async () => {
    const { store, gateway, sleeper, processPayment } = setup();
    jest
      .spyOn(gateway, 'getPayment')
      .mockReturnValueOnce(errAsync(new PaymentProviderUnavailableError()))
      .mockReturnValue(
        okAsync(aProviderPayment({ status: 'PENDING', providerTransactionId: 'fake-1' })),
      );

    const transaction = unwrap(await processPayment.execute(command()));

    expect(transaction.status).toBe('PENDING');
    expect(transaction.payment?.providerTransactionId).toBe('fake-1');
    expect(store.transactions.get(TRANSACTION_ID)?.payment?.providerStatus).toBe('PENDING');
    expect(sleeper.waits).toEqual(POLL_DELAYS);
  });

  it('applies a result that is already final when the payment is created', async () => {
    const { gateway, sleeper, processPayment } = setup();
    jest.spyOn(gateway, 'createCardPayment').mockReturnValueOnce(okAsync(aProviderPayment()));

    expect(unwrap(await processPayment.execute(command())).status).toBe('APPROVED');
    expect(sleeper.waits).toEqual([]);
  });

  it('releases the claim when the provider rejects the payment, so the buyer can retry', async () => {
    const { store, gateway, processPayment } = setup();
    jest
      .spyOn(gateway, 'createCardPayment')
      .mockReturnValueOnce(errAsync(new PaymentRejectedByProviderError('acceptance_token')));

    expect(await errorOf(processPayment.execute(command()))).toBe('PAYMENT_REJECTED_BY_PROVIDER');
    expect(store.transactions.get(TRANSACTION_ID)?.payment).toBeNull();
  });

  it('continues with the payment found by reference when the provider did not answer', async () => {
    const { gateway, processPayment } = setup();
    jest
      .spyOn(gateway, 'createCardPayment')
      .mockReturnValueOnce(errAsync(new PaymentProviderTimeoutError()));
    jest.spyOn(gateway, 'findPaymentByReference').mockReturnValueOnce(okAsync(aProviderPayment()));

    expect(unwrap(await processPayment.execute(command())).status).toBe('APPROVED');
  });

  it.each([
    ['nothing was found', okAsync(null)],
    ['the search failed too', errAsync(new PaymentProviderUnavailableError())],
  ])('releases the claim when the provider did not answer and %s', async (_case, search) => {
    const { store, gateway, processPayment } = setup();
    jest
      .spyOn(gateway, 'createCardPayment')
      .mockReturnValueOnce(errAsync(new PaymentProviderTimeoutError()));
    jest.spyOn(gateway, 'findPaymentByReference').mockReturnValueOnce(search);

    expect(await errorOf(processPayment.execute(command()))).toBe('PAYMENT_PROVIDER_TIMEOUT');
    expect(store.transactions.get(TRANSACTION_ID)?.payment).toBeNull();
  });

  it.each([
    ['a final transaction', aStoredTransaction({ status: 'CANCELLED' }), 'TRANSACTION_NOT_PAYABLE'],
    [
      'a transaction already paid',
      aTransaction().claimPayment('other-attempt', 1, NOW),
      'PAYMENT_ALREADY_SUBMITTED',
    ],
  ])('refuses %s', async (_case, transaction, code) => {
    const { processPayment } = setup({ transaction });

    expect(await errorOf(processPayment.execute(command()))).toBe(code);
  });

  it('lets only one of two concurrent payments reach the provider', async () => {
    const { store, gateway, processPayment } = setup();
    jest
      .spyOn(store, 'claimPaymentSubmission')
      .mockImplementationOnce(() =>
        new InMemoryCheckoutStore().claimPaymentSubmission(aTransaction()),
      );
    const create = jest.spyOn(gateway, 'createCardPayment');

    expect(await errorOf(processPayment.execute(command()))).toBe('PAYMENT_ALREADY_SUBMITTED');
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an unknown transaction',
      { transaction: aStoredTransaction({ id: 'other' }) },
      'TRANSACTION_NOT_FOUND',
    ],
    ['a missing customer', { customers: [] }, 'CUSTOMER_NOT_FOUND'],
  ])('reports %s', async (_case, options, code) => {
    const { processPayment } = setup(options);

    expect(await errorOf(processPayment.execute(command()))).toBe(code);
  });

  it('uses the codes as names when the coverage does not know the city', async () => {
    const { gateway, processPayment } = setup({ coverage: new InMemoryCoverageRepository() });
    const create = jest.spyOn(gateway, 'createCardPayment');

    await processPayment.execute(command());

    expect(create.mock.calls[0]?.[0].shippingAddress).toMatchObject({
      city: '11001',
      region: '11',
    });
  });
});

describe('ApplyPaymentResult', () => {
  const clock = new FakeClock(NOW);

  it('turns a result for another amount into ERROR and releases the stock', async () => {
    const store = new InMemoryCheckoutStore().withStock(PRODUCT_ID, 29);
    const claimed = aTransaction().claimPayment('attempt-1', 1, NOW);
    store.transactions.set(TRANSACTION_ID, claimed);
    const apply = new ApplyPaymentResult(store, store, new FakeIdGenerator([DELIVERY_ID]), clock);

    const { transaction, mismatch } = unwrap(
      await apply.execute(claimed, aProviderPayment({ amount: cop(1_000) })),
    );

    expect(mismatch).toBe(true);
    expect(transaction.status).toBe('ERROR');
    expect(store.transactions.get(TRANSACTION_ID)?.status).toBe('ERROR');
  });

  it('returns a final transaction unchanged', async () => {
    const store = new InMemoryCheckoutStore();
    const approved = aStoredTransaction({ status: 'APPROVED' });
    const apply = new ApplyPaymentResult(store, store, new FakeIdGenerator([DELIVERY_ID]), clock);

    expect(unwrap(await apply.execute(approved, aProviderPayment())).transaction).toBe(approved);
  });

  it('returns the stored state when another path applied a result first', async () => {
    const store = new InMemoryCheckoutStore().withStock(PRODUCT_ID, 29);
    const declined = aStoredTransaction({ status: 'DECLINED' });
    store.transactions.set(TRANSACTION_ID, declined);
    const apply = new ApplyPaymentResult(store, store, new FakeIdGenerator([DELIVERY_ID]), clock);

    const { transaction, mismatch } = unwrap(
      await apply.execute(aTransaction().claimPayment('attempt-1', 1, NOW), aProviderPayment()),
    );

    expect(transaction.status).toBe('DECLINED');
    expect(mismatch).toBe(false);
  });
});
