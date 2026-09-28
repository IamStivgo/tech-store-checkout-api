import { cop } from '../../../../test/builders/pricing.builder';
import { aNewTransaction, aTransaction } from '../../../../test/builders/transaction.builder';

import { Delivery } from './delivery.entity';
import { estimatedDeliveryDate } from './estimated-delivery-date';

describe('estimatedDeliveryDate', () => {
  it.each([
    // Thursday 24 September 2026, 15:15 in Colombia.
    ['2026-09-24T20:15:00.000Z', 1, '2026-09-25'],
    ['2026-09-24T20:15:00.000Z', 3, '2026-09-29'],
    ['2026-09-24T20:15:00.000Z', 10, '2026-10-08'],
    // 02:00 UTC on Saturday is still Friday night in Bogotá.
    ['2026-09-26T02:00:00.000Z', 1, '2026-09-28'],
  ])('from %s plus %i business days is %s', (from, days, expected) => {
    expect(estimatedDeliveryDate(new Date(from), days)).toBe(expected);
  });
});

describe('Delivery', () => {
  it('is assigned from an approved transaction with the latest promised day', () => {
    const now = new Date('2026-09-24T20:16:03.000Z');
    const transaction = aTransaction({
      delivery: {
        zone: 'NATIONAL_MAIN',
        billableWeightKg: 4,
        estimatedBusinessDays: { min: 2, max: 3 },
      },
      amounts: { ...aNewTransaction().amounts, deliveryFee: cop(8_000) },
    });

    const delivery = Delivery.assignFor(transaction, 'delivery-1', now);

    expect(delivery.id).toBe('delivery-1');
    expect(delivery.props).toMatchObject({
      transactionId: transaction.id,
      customerId: transaction.customerId,
      productId: transaction.productId,
      productName: 'Cable USB-C a USB-C 2 m (100 W)',
      quantity: 1,
      zone: 'NATIONAL_MAIN',
      deliveryFee: cop(8_000),
      status: 'ASSIGNED',
      estimatedDeliveryDate: '2026-09-29',
      createdAt: now,
    });
    expect(Delivery.restore(delivery.props).props).toEqual(delivery.props);
  });
});
