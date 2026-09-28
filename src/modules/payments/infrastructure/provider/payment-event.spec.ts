import {
  aSignedEvent,
  anEventTransaction,
} from '../../../../../test/builders/payment-event.builder';
import { unwrap } from '../../../../../test/builders/unwrap';

import { verifyPaymentEvent } from './payment-event';

const OPTIONS = { secret: 'events_secret_for_tests', environment: 'test' };

describe('verifyPaymentEvent', () => {
  it('trusts a correctly signed transaction event', () => {
    const payment = unwrap(verifyPaymentEvent(aSignedEvent(OPTIONS.secret), OPTIONS));

    expect(payment).toMatchObject({
      providerTransactionId: '15113-1790566893-12345',
      reference: 'CKT-20260924-7K3M9Q2PXA',
      status: 'APPROVED',
    });
    expect(payment?.amount.amountInCents).toBe(5_090_000);
  });

  it('accepts the checksum in upper case', () => {
    const event = aSignedEvent(OPTIONS.secret);
    const upper = {
      ...event,
      signature: { ...event.signature, checksum: event.signature.checksum.toUpperCase() },
    };

    expect(verifyPaymentEvent(upper, OPTIONS).isOk).toBe(true);
  });

  it.each([
    ['another secret', aSignedEvent('forged_secret')],
    [
      'a tampered status',
      (() => {
        const event = aSignedEvent(OPTIONS.secret);
        return {
          ...event,
          data: { transaction: { ...event.data.transaction, status: 'DECLINED' } },
        };
      })(),
    ],
    ['a body without signature', { event: 'transaction.updated', data: {} }],
    ['something that is not an event', 'hello'],
  ])('rejects %s', (_case, event) => {
    expect(verifyPaymentEvent(event, OPTIONS).isErr).toBe(true);
  });

  it.each([
    ['another environment', aSignedEvent(OPTIONS.secret, { environment: 'prod' })],
    ['another kind of event', aSignedEvent(OPTIONS.secret, { event: 'nequi_token.updated' })],
    [
      'an unknown status',
      aSignedEvent(OPTIONS.secret, { transaction: anEventTransaction({ status: 'REFUNDED' }) }),
    ],
  ])('ignores a signed event of %s', (_case, event) => {
    expect(unwrap(verifyPaymentEvent(event, OPTIONS))).toBeNull();
  });
});
