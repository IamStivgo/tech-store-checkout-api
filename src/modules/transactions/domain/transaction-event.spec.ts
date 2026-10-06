import { aProviderPayment } from '../../../../test/builders/provider-payment.builder';
import { aTransaction } from '../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../test/builders/unwrap';

import {
  claimReleasedEvents,
  creationEvents,
  finalizationEvents,
  paymentSubmittedEvents,
  webhookReceivedEvents,
} from './transaction-event';

const NOW = new Date('2026-09-24T20:17:00.000Z');
const DELIVERY_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const summary = (events: readonly { type: string; source: string }[]) =>
  events.map(({ type, source }) => `${type}/${source}`);

describe('transaction events', () => {
  it('records the creation with the total and the reserved units', () => {
    const events = creationEvents(aTransaction(), 'CHECKOUT_API');

    expect(events).toMatchObject([
      {
        type: 'TRANSACTION_CREATED',
        toStatus: 'PENDING',
        amountInCents: 5_090_000,
        details: { vatRatePercent: 19, vatBaseInCents: 3_352_900, vatAmountInCents: 637_100 },
      },
      { type: 'STOCK_RESERVED', details: { quantity: 1 } },
    ]);
  });

  it('records the submitted payment with the provider id, and a released claim', () => {
    const recorded = aTransaction()
      .claimPayment('attempt-1', 1, NOW)
      .withProviderPayment(aProviderPayment({ status: 'PENDING' }), NOW);

    expect(paymentSubmittedEvents(recorded, 'CHECKOUT_API')).toMatchObject([
      { type: 'PAYMENT_SUBMITTED', providerTransactionId: '15113-1790566893-12345' },
    ]);
    expect(summary(claimReleasedEvents(recorded, 'RECONCILIATION', NOW))).toEqual([
      'PAYMENT_CLAIM_RELEASED/RECONCILIATION',
    ]);
  });

  it('records an approval with the sold units and the delivery', () => {
    const before = aTransaction().claimPayment('attempt-1', 1, NOW);
    const settled = before.settle(aProviderPayment(), NOW, DELIVERY_ID);
    const after = settled.kind === 'settled' ? settled.transaction : before;

    expect(finalizationEvents(before, after, 'STATUS_SYNC')).toMatchObject([
      {
        type: 'STATUS_CHANGED',
        fromStatus: 'PENDING',
        toStatus: 'APPROVED',
        providerStatus: 'APPROVED',
      },
      { type: 'STOCK_CONFIRMED', details: { quantity: 1 } },
      { type: 'DELIVERY_ASSIGNED', details: { deliveryId: DELIVERY_ID } },
    ]);
  });

  it('records a cancellation that releases the units, and a result that did not match', () => {
    const before = aTransaction();
    const cancelled = unwrap(before.cancel(NOW));

    expect(summary(finalizationEvents(before, cancelled, 'CHECKOUT_API'))).toEqual([
      'STATUS_CHANGED/CHECKOUT_API',
      'STOCK_RELEASED/CHECKOUT_API',
    ]);
    expect(summary(finalizationEvents(before, cancelled, 'WEBHOOK', { mismatch: true }))[0]).toBe(
      'RESULT_MISMATCH/WEBHOOK',
    );
  });

  it('records a received webhook and whether it changed the transaction', () => {
    expect(
      webhookReceivedEvents(aTransaction(), aProviderPayment(), 'already-final', NOW),
    ).toMatchObject([
      { type: 'WEBHOOK_RECEIVED', source: 'WEBHOOK', details: { result: 'already-final' } },
    ]);
  });
});
