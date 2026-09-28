import { cop } from '../../../../test/builders/pricing.builder';
import {
  aNewTransaction,
  aStoredTransaction,
  aTransaction,
  RESERVATION_TTL_MINUTES,
  TRANSACTION_CREATED_AT,
} from '../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../test/builders/unwrap';

import { isFinalStatus, TRANSACTION_STATUSES } from './transaction-status';
import { Transaction } from './transaction.entity';

describe('Transaction', () => {
  it('starts PENDING, without payment, reserving the stock for 15 minutes', () => {
    const transaction = aTransaction();

    expect(transaction.status).toBe('PENDING');
    expect(transaction.payment).toBeNull();
    expect(transaction.deliveryId).toBeNull();
    expect(transaction.finalizedAt).toBeNull();
    expect(transaction.isFinal()).toBe(false);
    expect(transaction.updatedAt).toEqual(TRANSACTION_CREATED_AT);
    expect(transaction.reservationExpiresAt).toEqual(new Date('2026-09-24T20:30:00.000Z'));
  });

  it('keeps the product snapshot, the charges and the quoted delivery', () => {
    const transaction = aTransaction();

    expect(transaction.product.name).toBe('Cable USB-C a USB-C 2 m (100 W)');
    expect(transaction.amounts.total).toEqual(cop(50_900));
    expect(transaction.delivery.zone).toBe('LOCAL');
    expect(transaction.shippingAddress.cityCode).toBe('11001');
    expect([transaction.id, transaction.quantity, transaction.createdAt]).toEqual([
      aNewTransaction().id,
      1,
      TRANSACTION_CREATED_AT,
    ]);
    expect([transaction.reference, transaction.productId, transaction.customerId]).toEqual([
      'CKT-20260924-7K3M9Q2PXA',
      aNewTransaction().productId,
      aNewTransaction().customerId,
    ]);
  });

  it.each([0, 1.5])('rejects a quantity of %s', (quantity) => {
    const result = Transaction.create(aNewTransaction({ quantity }), RESERVATION_TTL_MINUTES);

    expect(result.isErr && result.error.fieldErrors[0]?.field).toBe('quantity');
  });

  it('rejects charges that do not add up to the total', () => {
    const result = Transaction.create(
      aNewTransaction({
        amounts: { ...aNewTransaction().amounts, total: cop(50_000) },
      }),
      RESERVATION_TTL_MINUTES,
    );

    expect(result.isErr && result.error.fieldErrors[0]?.field).toBe('amounts');
  });

  describe('expire', () => {
    it('expires an unpaid order once its reservation ran out', () => {
      const transaction = aTransaction();
      const expired = transaction.expire(transaction.reservationExpiresAt);

      expect(expired?.status).toBe('EXPIRED');
      expect(expired?.finalizedAt).toEqual(transaction.reservationExpiresAt);
    });

    it('keeps an order that can still be paid or whose payment was sent', () => {
      const transaction = aTransaction();
      const later = new Date(transaction.reservationExpiresAt.getTime() + 60_000);
      const claimed = transaction.claimPayment('attempt-1', 1, transaction.createdAt);

      expect(transaction.expire(transaction.createdAt)).toBeNull();
      expect(claimed.expire(later)).toBeNull();
    });
  });

  describe('cancel', () => {
    const now = new Date('2026-09-24T20:20:00.000Z');

    it('cancels a pending transaction whose payment was not sent', () => {
      const cancelled = unwrap(aTransaction().cancel(now));

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.finalizedAt).toEqual(now);
      expect(cancelled.updatedAt).toEqual(now);
      expect(cancelled.isFinal()).toBe(true);
    });

    it('refuses once the payment was sent', () => {
      const withPayment = aStoredTransaction({
        payment: {
          attemptId: 'attempt-1',
          submittedAt: now,
          installments: 1,
          providerTransactionId: null,
          providerStatus: null,
          statusMessage: null,
          cardBrand: null,
          cardLastFour: null,
        },
      });

      const result = withPayment.cancel(now);

      expect(result.isErr && result.error.code).toBe('TRANSACTION_NOT_CANCELLABLE');
    });

    it('refuses a final transaction', () => {
      const result = aStoredTransaction({ status: 'APPROVED' }).cancel(now);

      expect(result.isErr && result.error.context).toEqual({ status: 'APPROVED' });
    });
  });
});

describe('isFinalStatus', () => {
  it('treats every status but PENDING as final', () => {
    expect(TRANSACTION_STATUSES.filter(isFinalStatus)).toEqual([
      'APPROVED',
      'DECLINED',
      'VOIDED',
      'ERROR',
      'CANCELLED',
      'EXPIRED',
    ]);
  });
});
