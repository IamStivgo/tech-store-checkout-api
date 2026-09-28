/** Reading a PENDING transaction syncs it with the provider (T-045). */
import { PaymentProviderUnavailableError } from '../../src/modules/payments/domain/payment-gateway.errors';
import { FakePaymentGateway } from '../../src/modules/payments/infrastructure/fake/fake-payment-gateway';
import { ApplyPaymentResult } from '../../src/modules/transactions/application/apply-payment-result.use-case';
import { GetTransaction } from '../../src/modules/transactions/application/get-transaction.use-case';
import { errAsync, okAsync } from '../../src/shared/domain/result';
import { aProviderPayment } from '../builders/provider-payment.builder';
import { aStoredTransaction, PRODUCT_ID, TRANSACTION_ID } from '../builders/transaction.builder';
import { unwrap } from '../builders/unwrap';
import { FakeIdGenerator } from '../fakes/fake-id-generator';
import { InMemoryCheckoutStore } from '../fakes/in-memory-checkout.store';

const DELIVERY_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const PROVIDER_ID = '15113-1790566893-12345';

const sentPayment = (providerTransactionId: string | null = PROVIDER_ID) =>
  aStoredTransaction({
    payment: {
      attemptId: 'attempt-1',
      submittedAt: new Date('2026-09-24T20:16:00.000Z'),
      installments: 1,
      providerTransactionId,
      providerStatus: 'PENDING',
      statusMessage: null,
      cardBrand: null,
      cardLastFour: null,
    },
  });

const setup = (transaction = sentPayment()) => {
  const store = new InMemoryCheckoutStore();
  store.stock.set(PRODUCT_ID, { available: 29, reserved: 1, sold: 0 });
  store.transactions.set(transaction.id, transaction);
  const gateway = new FakePaymentGateway();
  let now = new Date('2026-09-24T20:17:00.000Z').getTime();
  const clock = { now: () => new Date(now) };
  const getTransaction = new GetTransaction(store, {
    gateway,
    applyResult: new ApplyPaymentResult(store, store, new FakeIdGenerator([DELIVERY_ID]), clock),
    clock,
    minIntervalMs: 2000,
  });
  const advance = (ms: number) => {
    now += ms;
  };
  return { store, gateway, getTransaction, advance };
};

describe('GetTransaction with provider sync', () => {
  it('applies the final result of a pending payment when it is read', async () => {
    const { store, gateway, getTransaction } = setup();
    jest.spyOn(gateway, 'getPayment').mockReturnValue(okAsync(aProviderPayment()));

    const read = unwrap(await getTransaction.execute(TRANSACTION_ID));

    expect(read).toMatchObject({ status: 'APPROVED', deliveryId: DELIVERY_ID });
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 29, reserved: 0, sold: 1 });
  });

  it('asks the provider at most once every 2 seconds per transaction', async () => {
    const { gateway, getTransaction, advance } = setup();
    const getPayment = jest
      .spyOn(gateway, 'getPayment')
      .mockReturnValue(okAsync(aProviderPayment({ status: 'PENDING' })));

    await getTransaction.execute(TRANSACTION_ID);
    advance(1999);
    const meanwhile = unwrap(await getTransaction.execute(TRANSACTION_ID));
    advance(1);
    await getTransaction.execute(TRANSACTION_ID);

    expect(meanwhile.status).toBe('PENDING');
    expect(getPayment).toHaveBeenCalledTimes(2);
  });

  it('returns the stored state when the provider fails', async () => {
    const { gateway, getTransaction } = setup();
    jest
      .spyOn(gateway, 'getPayment')
      .mockReturnValue(errAsync(new PaymentProviderUnavailableError()));

    expect(unwrap(await getTransaction.execute(TRANSACTION_ID)).status).toBe('PENDING');
  });

  it('does not ask about a payment without a provider id or an unpaid transaction', async () => {
    const claimed = setup(sentPayment(null));
    const unpaid = setup(aStoredTransaction());
    const spies = [claimed, unpaid].map(({ gateway }) => jest.spyOn(gateway, 'getPayment'));

    await claimed.getTransaction.execute(TRANSACTION_ID);
    await unpaid.getTransaction.execute(TRANSACTION_ID);

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
