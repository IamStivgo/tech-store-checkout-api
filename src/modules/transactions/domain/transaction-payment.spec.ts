import { cop } from '../../../../test/builders/pricing.builder';
import { aProviderPayment } from '../../../../test/builders/provider-payment.builder';
import { aStoredTransaction, aTransaction } from '../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../test/builders/unwrap';

import type { Transaction } from './transaction.entity';

const BEFORE_EXPIRY = new Date('2026-09-24T20:16:00.000Z');
const SETTLED_AT = new Date('2026-09-24T20:16:03.000Z');
const claimed = (): Transaction => aTransaction().claimPayment('attempt-1', 3, BEFORE_EXPIRY);
const settled = (transaction: Transaction, ...args: Parameters<Transaction['settle']>) => {
  const settlement = transaction.settle(...args);
  if (settlement.kind !== 'settled') {
    throw new Error('Expected the transaction to be settled');
  }
  return settlement;
};

describe('Transaction payment', () => {
  describe('ensurePayable', () => {
    it('accepts a pending transaction whose stock is still reserved', () => {
      expect(aTransaction().ensurePayable(BEFORE_EXPIRY).isOk).toBe(true);
    });

    it.each([
      [
        'a final transaction',
        aStoredTransaction({ status: 'DECLINED' }),
        BEFORE_EXPIRY,
        'TRANSACTION_NOT_PAYABLE',
        { reason: 'FINAL', status: 'DECLINED' },
      ],
      [
        'an expired reservation',
        aTransaction(),
        new Date('2026-09-24T20:30:00.000Z'),
        'TRANSACTION_NOT_PAYABLE',
        { reason: 'RESERVATION_EXPIRED', status: 'PENDING' },
      ],
      ['a payment already sent', claimed(), BEFORE_EXPIRY, 'PAYMENT_ALREADY_SUBMITTED', {}],
    ])('refuses %s', (_case, transaction, now, code, context) => {
      const result = transaction.ensurePayable(now);

      expect(result.isErr && result.error).toMatchObject({ code, context });
    });
  });

  it('claims the payment for one attempt before calling the provider', () => {
    const transaction = claimed();

    expect(transaction.payment).toEqual({
      attemptId: 'attempt-1',
      submittedAt: BEFORE_EXPIRY,
      installments: 3,
      providerTransactionId: null,
      providerStatus: null,
      statusMessage: null,
      cardBrand: null,
      cardLastFour: null,
    });
    expect(transaction.status).toBe('PENDING');
    expect(transaction.updatedAt).toEqual(BEFORE_EXPIRY);
  });

  it('records what the provider reports while the payment is pending', () => {
    const transaction = claimed().withProviderPayment(
      aProviderPayment({ status: 'PENDING' }),
      SETTLED_AT,
    );

    expect(transaction.payment).toMatchObject({
      attemptId: 'attempt-1',
      providerTransactionId: '15113-1790566893-12345',
      providerStatus: 'PENDING',
      cardBrand: 'VISA',
      cardLastFour: '4242',
    });
    expect(transaction.status).toBe('PENDING');
  });

  it('ignores provider data when no payment was claimed', () => {
    const transaction = aTransaction();

    expect(transaction.withProviderPayment(aProviderPayment(), SETTLED_AT)).toBe(transaction);
  });

  describe('settle', () => {
    it('approves the transaction and links its delivery', () => {
      const { transaction, mismatch } = settled(
        claimed(),
        aProviderPayment(),
        SETTLED_AT,
        'delivery-1',
      );

      expect(mismatch).toBe(false);
      expect(transaction.status).toBe('APPROVED');
      expect(transaction.deliveryId).toBe('delivery-1');
      expect(transaction.finalizedAt).toEqual(SETTLED_AT);
      expect(transaction.payment).toMatchObject({ providerStatus: 'APPROVED', installments: 3 });
    });

    it('declines without a delivery and keeps the provider message', () => {
      const { transaction } = settled(
        claimed(),
        aProviderPayment({ status: 'DECLINED', statusMessage: 'La transacción fue rechazada' }),
        SETTLED_AT,
        'delivery-1',
      );

      expect(transaction.status).toBe('DECLINED');
      expect(transaction.deliveryId).toBeNull();
      expect(transaction.payment?.statusMessage).toBe('La transacción fue rechazada');
    });

    it.each([
      ['another amount', { amount: cop(1_000) }],
      ['another reference', { reference: 'CKT-20260924-OTHER00000' }],
    ])('turns a result for %s into ERROR', (_case, overrides) => {
      const { transaction, mismatch } = settled(
        claimed(),
        aProviderPayment(overrides),
        SETTLED_AT,
        'delivery-1',
      );

      expect(mismatch).toBe(true);
      expect(transaction.status).toBe('ERROR');
      expect(transaction.deliveryId).toBeNull();
      expect(transaction.payment?.statusMessage).toBe(
        'The payment result does not match the transaction',
      );
    });

    it('never changes a final transaction', () => {
      expect(
        aStoredTransaction({ status: 'DECLINED' }).settle(aProviderPayment(), SETTLED_AT, 'd'),
      ).toEqual({
        kind: 'already-final',
      });
    });
  });

  it('keeps the payment claim when cancelling is refused', () => {
    expect(unwrap(aTransaction().cancel(SETTLED_AT)).status).toBe('CANCELLED');
    expect(claimed().cancel(SETTLED_AT).isErr).toBe(true);
  });
});
