import {
  aStoredTransaction,
  aTransaction,
  PRODUCT_ID,
  TRANSACTION_ID,
} from '../../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../../test/builders/unwrap';

import { toTransaction, toTransactionItem } from './transaction.mapper';

const PAYMENT = {
  attemptId: 'attempt-1',
  submittedAt: new Date('2026-09-24T20:16:00.000Z'),
  installments: 3,
  providerTransactionId: '15113-1',
  providerStatus: 'APPROVED',
  statusMessage: null,
  cardBrand: 'VISA',
  cardLastFour: '4242',
};

describe('transaction mapper', () => {
  it('stores a PENDING transaction with its sparse pending-index keys', () => {
    const item = toTransactionItem(aTransaction());

    expect(item).toMatchObject({
      transactionId: TRANSACTION_ID,
      status: 'PENDING',
      productId: PRODUCT_ID,
      productSnapshot: { sku: 'TEC-CBL-USBC', unitPriceInCents: 3_990_000, weightGrams: 150 },
      amounts: {
        productAmountInCents: 3_990_000,
        serviceFeeInCents: 300_000,
        deliveryFeeInCents: 800_000,
        totalInCents: 5_090_000,
        currency: 'COP',
      },
      zoneCode: 'LOCAL',
      pendingBucket: 'PENDING',
      pendingSince: '2026-09-24T20:15:00.000Z',
      reservationExpiresAt: '2026-09-24T20:30:00.000Z',
      shippingAddress: {
        recipientName: 'Ana María Gómez',
        cityCode: '11001',
        postalCode: '110111',
      },
    });
    expect(item.payment).toBeUndefined();
    expect(item.finalizedAt).toBeUndefined();
  });

  it('drops the pending keys of a final transaction and keeps its payment', () => {
    const item = toTransactionItem(
      aStoredTransaction({
        status: 'APPROVED',
        payment: PAYMENT,
        deliveryId: 'delivery-1',
        finalizedAt: new Date('2026-09-24T20:16:03.000Z'),
      }),
    );

    expect(item).toMatchObject({
      status: 'APPROVED',
      deliveryId: 'delivery-1',
      finalizedAt: '2026-09-24T20:16:03.000Z',
      payment: { ...PAYMENT, submittedAt: '2026-09-24T20:16:00.000Z' },
    });
    expect(item.pendingBucket).toBeUndefined();
    expect(item.pendingSince).toBeUndefined();
  });

  it.each([
    ['a new transaction', aTransaction()],
    [
      'a paid transaction without optional address fields',
      aStoredTransaction({
        status: 'APPROVED',
        payment: PAYMENT,
        finalizedAt: new Date('2026-09-24T20:16:03.000Z'),
      }),
    ],
  ])('reads back %s unchanged', (_case, transaction) => {
    const restored = unwrap(toTransaction(toTransactionItem(transaction)));

    expect(toTransactionItem(restored)).toEqual(toTransactionItem(transaction));
  });

  it.each([
    ['a missing attribute', { reference: undefined }],
    ['an unknown status', { status: 'LOST' }],
    [
      'an address that breaks the rules',
      {
        shippingAddress: {
          ...(toTransactionItem(aTransaction()).shippingAddress as object),
          cityCode: '1',
        },
      },
    ],
    [
      'an unsupported currency',
      { amounts: { ...(toTransactionItem(aTransaction()).amounts as object), currency: 'USD' } },
    ],
  ])('rejects %s as corrupt data', (_case, overrides) => {
    const result = toTransaction({ ...toTransactionItem(aTransaction()), ...overrides });

    expect(result.isErr && result.error.operation).toBe('transactions.toDomain');
  });
});
