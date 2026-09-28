import {
  ShippingAddress,
  type ShippingAddressData,
} from '../../src/modules/transactions/domain/shipping-address.vo';
import {
  Transaction,
  type NewTransactionProps,
  type TransactionProps,
} from '../../src/modules/transactions/domain/transaction.entity';

import { CUSTOMER_ID } from './customer.builder';
import { cop } from './pricing.builder';
import { unwrap } from './unwrap';

export const TRANSACTION_ID = '5c0e8f2a-1b3d-4e5f-9a7b-8c9d0e1f2a3b';
export const PRODUCT_ID = '7d094266-0b4e-4789-9522-96e1cd7ffa60';
export const TRANSACTION_CREATED_AT = new Date('2026-09-24T20:15:00.000Z');
export const RESERVATION_TTL_MINUTES = 15;

/** Delivery address of the mockups (copy deck §7.2). */
export const aShippingAddressData = (
  overrides: Partial<ShippingAddressData> = {},
): ShippingAddressData => ({
  recipientName: 'Ana María Gómez',
  phone: '3001234567',
  addressLine1: 'Calle 100 # 10-20',
  addressLine2: 'Apto 501, Torre 2',
  departmentCode: '11',
  cityCode: '11001',
  postalCode: '110111',
  notes: 'Portería 24 horas',
  ...overrides,
});

/** Scenario E1: one USB-C cable delivered in Bogotá (local zone). */
export const aNewTransaction = (
  overrides: Partial<NewTransactionProps> = {},
): NewTransactionProps => ({
  id: TRANSACTION_ID,
  reference: 'CKT-20260924-7K3M9Q2PXA',
  productId: PRODUCT_ID,
  customerId: CUSTOMER_ID,
  product: {
    sku: 'TEC-CBL-USBC',
    name: 'Cable USB-C a USB-C 2 m (100 W)',
    unitPrice: cop(39_900),
    weightGrams: 150,
  },
  quantity: 1,
  shippingAddress: unwrap(ShippingAddress.create(aShippingAddressData())),
  amounts: {
    productAmount: cop(39_900),
    serviceFee: cop(3_000),
    deliveryFee: cop(8_000),
    total: cop(50_900),
  },
  delivery: { zone: 'LOCAL', billableWeightKg: 1, estimatedBusinessDays: { min: 1, max: 1 } },
  createdAt: TRANSACTION_CREATED_AT,
  ...overrides,
});

export const aTransaction = (overrides: Partial<NewTransactionProps> = {}): Transaction =>
  unwrap(Transaction.create(aNewTransaction(overrides), RESERVATION_TTL_MINUTES));

/** A transaction in any state, e.g. with a payment already sent. */
export const aStoredTransaction = (overrides: Partial<TransactionProps> = {}): Transaction => {
  const created = aTransaction();
  return Transaction.restore({
    ...aNewTransaction(),
    status: created.status,
    payment: null,
    deliveryId: null,
    reservationExpiresAt: created.reservationExpiresAt,
    finalizedAt: null,
    updatedAt: created.updatedAt,
    ...overrides,
  });
};
