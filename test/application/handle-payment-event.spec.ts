/** The webhook use case with the in-memory store and the fake gateway's event secret. */
import {
  FAKE_EVENTS,
  FakePaymentGateway,
} from '../../src/modules/payments/infrastructure/fake/fake-payment-gateway';
import { ApplyPaymentResult } from '../../src/modules/transactions/application/apply-payment-result.use-case';
import { HandlePaymentEvent } from '../../src/modules/transactions/application/handle-payment-event.use-case';
import { aSignedEvent, anEventTransaction } from '../builders/payment-event.builder';
import { aTransaction, PRODUCT_ID, TRANSACTION_ID } from '../builders/transaction.builder';
import { unwrap } from '../builders/unwrap';
import { FakeClock } from '../fakes/fake-clock';
import { FakeIdGenerator } from '../fakes/fake-id-generator';
import { InMemoryCheckoutStore } from '../fakes/in-memory-checkout.store';

const DELIVERY_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const setup = () => {
  const store = new InMemoryCheckoutStore();
  store.stock.set(PRODUCT_ID, { available: 29, reserved: 1, sold: 0 });
  store.transactions.set(TRANSACTION_ID, aTransaction());
  const clock = new FakeClock(new Date('2026-09-24T20:17:00.000Z'));
  const handle = new HandlePaymentEvent(
    store,
    new FakePaymentGateway(),
    new ApplyPaymentResult(store, store, new FakeIdGenerator([DELIVERY_ID]), clock),
  );
  return { store, handle };
};

describe('HandlePaymentEvent', () => {
  it('applies the final result of a known transaction', async () => {
    const { store, handle } = setup();

    expect(unwrap(await handle.execute(aSignedEvent(FAKE_EVENTS.secret)))).toBe('applied');
    expect(store.transactions.get(TRANSACTION_ID)).toMatchObject({
      status: 'APPROVED',
      deliveryId: DELIVERY_ID,
    });
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 29, reserved: 0, sold: 1 });
  });

  it.each([
    ['an unknown reference', anEventTransaction({ reference: 'CKT-20260924-UNKNOWN000' })],
    ['a payment still pending', anEventTransaction({ status: 'PENDING' })],
  ])('acknowledges and ignores %s', async (_case, transaction) => {
    const { store, handle } = setup();

    expect(unwrap(await handle.execute(aSignedEvent(FAKE_EVENTS.secret, { transaction })))).toBe(
      'ignored',
    );
    expect(store.transactions.get(TRANSACTION_ID)?.status).toBe('PENDING');
  });

  it('refuses an event with a wrong signature', async () => {
    const { store, handle } = setup();

    const result = await handle.execute(aSignedEvent('forged_secret'));

    expect(result.isErr && result.error.code).toBe('INVALID_EVENT_SIGNATURE');
    expect(store.transactions.get(TRANSACTION_ID)?.status).toBe('PENDING');
  });
});
