/** The scheduled reconciliation with the in-memory store and the fake payment gateway. */
import { PaymentProviderUnavailableError } from '../../src/modules/payments/domain/payment-gateway.errors';
import { FakePaymentGateway } from '../../src/modules/payments/infrastructure/fake/fake-payment-gateway';
import { ApplyPaymentResult } from '../../src/modules/transactions/application/apply-payment-result.use-case';
import { ReconcileTransactions } from '../../src/modules/transactions/application/reconcile-transactions.use-case';
import type { Transaction } from '../../src/modules/transactions/domain/transaction.entity';
import { PersistenceError } from '../../src/shared/domain/persistence-error';
import { errAsync, okAsync } from '../../src/shared/domain/result';
import { aProviderPayment } from '../builders/provider-payment.builder';
import { aStoredTransaction, aTransaction, PRODUCT_ID } from '../builders/transaction.builder';
import { unwrap } from '../builders/unwrap';
import { FakeClock } from '../fakes/fake-clock';
import { FakeIdGenerator } from '../fakes/fake-id-generator';
import { InMemoryCheckoutStore } from '../fakes/in-memory-checkout.store';

// The reservation of the builder's transaction (created 20:15) runs out at 20:30.
const AFTER_EXPIRY = new Date('2026-09-24T20:31:00.000Z');
const BEFORE_EXPIRY = new Date('2026-09-24T20:20:00.000Z');
const DELIVERY_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const OTHER_ID = '6f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f';

const sent = (providerTransactionId: string | null, submittedAt = BEFORE_EXPIRY) =>
  aStoredTransaction({
    payment: {
      attemptId: 'attempt-1',
      submittedAt,
      installments: 1,
      providerTransactionId,
      providerStatus: providerTransactionId ? 'PENDING' : null,
      statusMessage: null,
      cardBrand: null,
      cardLastFour: null,
    },
  });

const setup = (now: Date, ...pending: Transaction[]) => {
  const store = new InMemoryCheckoutStore();
  store.stock.set(PRODUCT_ID, { available: 29, reserved: pending.length, sold: 0 });
  for (const transaction of pending) {
    store.transactions.set(transaction.id, transaction);
  }
  const gateway = new FakePaymentGateway();
  const clock = new FakeClock(now);
  const reconcile = new ReconcileTransactions({
    transactions: store,
    checkout: store,
    gateway,
    applyResult: new ApplyPaymentResult(store, store, new FakeIdGenerator([DELIVERY_ID]), clock),
    clock,
    batchSize: 50,
    lostClaimAfterMs: 10 * 60_000,
  });
  return { store, gateway, reconcile };
};

describe('ReconcileTransactions', () => {
  it('expires a reservation that ran out without a payment and releases its stock', async () => {
    const transaction = aTransaction();
    const { store, reconcile } = setup(AFTER_EXPIRY, transaction);

    expect(unwrap(await reconcile.execute())).toEqual({ expired: 1, synced: 0, failed: 0 });
    expect(store.transactions.get(transaction.id)?.status).toBe('EXPIRED');
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 30, reserved: 0, sold: 0 });
  });

  it('leaves a reservation that can still be paid', async () => {
    const { store, reconcile } = setup(BEFORE_EXPIRY, aTransaction());

    expect(unwrap(await reconcile.execute())).toEqual({ expired: 0, synced: 0, failed: 0 });
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 29, reserved: 1, sold: 0 });
  });

  it('applies the final result of a payment sent to the provider', async () => {
    const transaction = sent('15113-1790566893-12345');
    const { store, gateway, reconcile } = setup(AFTER_EXPIRY, transaction);
    const getPayment = jest
      .spyOn(gateway, 'getPayment')
      .mockReturnValue(okAsync(aProviderPayment()));

    expect(unwrap(await reconcile.execute())).toEqual({ expired: 0, synced: 1, failed: 0 });
    expect(getPayment).toHaveBeenCalledWith('15113-1790566893-12345');
    expect(store.transactions.get(transaction.id)).toMatchObject({
      status: 'APPROVED',
      deliveryId: DELIVERY_ID,
    });
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 29, reserved: 0, sold: 1 });
  });

  it('finds by reference a payment whose provider id was never stored', async () => {
    const transaction = sent(null);
    const { store, gateway, reconcile } = setup(AFTER_EXPIRY, transaction);
    jest
      .spyOn(gateway, 'findPaymentByReference')
      .mockReturnValue(okAsync(aProviderPayment({ status: 'DECLINED' })));

    expect(unwrap(await reconcile.execute())).toEqual({ expired: 0, synced: 1, failed: 0 });
    expect(store.transactions.get(transaction.id)?.status).toBe('DECLINED');
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 30, reserved: 0, sold: 0 });
  });

  it('keeps the provider id of a payment that is still pending', async () => {
    const transaction = sent(null);
    const { store, gateway, reconcile } = setup(AFTER_EXPIRY, transaction);
    jest
      .spyOn(gateway, 'findPaymentByReference')
      .mockReturnValue(okAsync(aProviderPayment({ status: 'PENDING' })));

    expect(unwrap(await reconcile.execute())).toEqual({ expired: 0, synced: 0, failed: 0 });
    expect(store.transactions.get(transaction.id)?.payment?.providerTransactionId).toBe(
      aProviderPayment().providerTransactionId,
    );
  });

  it('forgets a claimed payment the provider never got, so the reservation can expire', async () => {
    const unpaid = aTransaction();
    const { store, gateway, reconcile } = setup(AFTER_EXPIRY, unpaid);
    const claimed = unpaid.claimPayment('attempt-1', 1, new Date('2026-09-24T20:16:00.000Z'));
    await store.claimPaymentSubmission(claimed);
    jest.spyOn(gateway, 'findPaymentByReference').mockReturnValue(okAsync(null));

    await reconcile.execute();
    expect(store.transactions.get(unpaid.id)?.payment).toBeNull();
    expect(unwrap(await reconcile.execute())).toEqual({ expired: 1, synced: 0, failed: 0 });
  });

  it('waits before forgetting a claim the provider may still be receiving', async () => {
    const transaction = sent(null, new Date('2026-09-24T20:25:00.000Z'));
    const { store, gateway, reconcile } = setup(AFTER_EXPIRY, transaction);
    jest.spyOn(gateway, 'findPaymentByReference').mockReturnValue(okAsync(null));
    const release = jest.spyOn(store, 'releasePaymentClaim');

    await reconcile.execute();

    expect(release).not.toHaveBeenCalled();
  });

  it('counts a transaction that fails and goes on with the rest', async () => {
    const failing = sent('15113-1790566893-12345');
    const unpaid = aTransaction({ id: OTHER_ID, createdAt: new Date('2026-09-24T20:14:00.000Z') });
    const { store, gateway, reconcile } = setup(AFTER_EXPIRY, failing, unpaid);
    jest
      .spyOn(gateway, 'getPayment')
      .mockReturnValue(errAsync(new PaymentProviderUnavailableError()));

    expect(unwrap(await reconcile.execute())).toEqual({ expired: 1, synced: 0, failed: 1 });
    expect(store.transactions.get(failing.id)?.status).toBe('PENDING');
  });

  it('fails the run when the pending transactions cannot be read', async () => {
    const { store, reconcile } = setup(AFTER_EXPIRY, aTransaction());
    store.failWith(new PersistenceError('transactions.findPending', 'down'));

    expect((await reconcile.execute()).isErr).toBe(true);
  });
});
