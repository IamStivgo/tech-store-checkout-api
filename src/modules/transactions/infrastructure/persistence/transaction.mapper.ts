import { z } from 'zod';

import { Money } from '../../../../shared/domain/money.vo';
import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { err, ok, type Result } from '../../../../shared/domain/result';
import { ZONE_CODES } from '../../../coverage/domain/zone-code';
import { ShippingAddress } from '../../domain/shipping-address.vo';
import { TRANSACTION_STATUSES } from '../../domain/transaction-status';
import { Transaction } from '../../domain/transaction.entity';

/** Value of the sparse `pending-index` key: only PENDING transactions carry it. */
export const PENDING_BUCKET = 'PENDING';
const MAPPING_OPERATION = 'transactions.toDomain';

const optionalString = z.string().nullish();

const itemSchema = z.object({
  transactionId: z.string().min(1),
  reference: z.string().min(1),
  status: z.enum(TRANSACTION_STATUSES),
  productId: z.string().min(1),
  customerId: z.string().min(1),
  productSnapshot: z.object({
    sku: z.string(),
    name: z.string(),
    unitPriceInCents: z.number(),
    weightGrams: z.number(),
  }),
  quantity: z.number(),
  shippingAddress: z.object({
    recipientName: z.string(),
    phone: z.string(),
    addressLine1: z.string(),
    addressLine2: optionalString,
    departmentCode: z.string(),
    cityCode: z.string(),
    postalCode: optionalString,
    notes: optionalString,
  }),
  amounts: z.object({
    productAmountInCents: z.number(),
    serviceFeeInCents: z.number(),
    deliveryFeeInCents: z.number(),
    totalInCents: z.number(),
    currency: z.string(),
  }),
  zoneCode: z.enum(ZONE_CODES),
  billableWeightKg: z.number(),
  estimatedBusinessDays: z.object({ min: z.number(), max: z.number() }),
  payment: z
    .object({
      attemptId: z.string(),
      submittedAt: z.iso.datetime(),
      installments: z.number(),
      providerTransactionId: optionalString,
      providerStatus: optionalString,
      statusMessage: optionalString,
      cardBrand: optionalString,
      cardLastFour: optionalString,
    })
    .nullish(),
  deliveryId: optionalString,
  reservationExpiresAt: z.iso.datetime(),
  finalizedAt: z.iso.datetime().nullish(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

type Item = z.infer<typeof itemSchema>;

const iso = (date: Date): string => date.toISOString();

/** The payment map as stored, e.g. for the conditional updates of the payment claim. */
export const toPaymentItem = (
  payment: NonNullable<Transaction['payment']>,
): Record<string, unknown> => ({ ...payment, submittedAt: iso(payment.submittedAt) });

export const toTransactionItem = (transaction: Transaction): Record<string, unknown> => {
  const { product, shippingAddress: address, amounts, delivery, payment } = transaction;
  const pending = transaction.status === 'PENDING';

  return {
    transactionId: transaction.id,
    reference: transaction.reference,
    status: transaction.status,
    productId: transaction.productId,
    customerId: transaction.customerId,
    productSnapshot: {
      sku: product.sku,
      name: product.name,
      unitPriceInCents: product.unitPrice.amountInCents,
      weightGrams: product.weightGrams,
    },
    quantity: transaction.quantity,
    shippingAddress: {
      recipientName: address.recipientName.value,
      phone: address.phone.value,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? undefined,
      departmentCode: address.departmentCode,
      cityCode: address.cityCode,
      postalCode: address.postalCode ?? undefined,
      notes: address.notes ?? undefined,
    },
    amounts: {
      productAmountInCents: amounts.productAmount.amountInCents,
      serviceFeeInCents: amounts.serviceFee.amountInCents,
      deliveryFeeInCents: amounts.deliveryFee.amountInCents,
      totalInCents: amounts.total.amountInCents,
      currency: amounts.total.currency,
    },
    zoneCode: delivery.zone,
    billableWeightKg: delivery.billableWeightKg,
    estimatedBusinessDays: delivery.estimatedBusinessDays,
    payment: payment ? toPaymentItem(payment) : undefined,
    deliveryId: transaction.deliveryId ?? undefined,
    reservationExpiresAt: iso(transaction.reservationExpiresAt),
    finalizedAt: transaction.finalizedAt ? iso(transaction.finalizedAt) : undefined,
    pendingBucket: pending ? PENDING_BUCKET : undefined,
    pendingSince: pending ? iso(transaction.createdAt) : undefined,
    createdAt: iso(transaction.createdAt),
    updatedAt: iso(transaction.updatedAt),
  };
};

const toAmounts = (amounts: Item['amounts']) => {
  const money = (cents: number) => Money.create(cents, amounts.currency);
  return money(amounts.productAmountInCents).andThen((productAmount) =>
    money(amounts.serviceFeeInCents).andThen((serviceFee) =>
      money(amounts.deliveryFeeInCents).andThen((deliveryFee) =>
        money(amounts.totalInCents).map((total) => ({
          productAmount,
          serviceFee,
          deliveryFee,
          total,
        })),
      ),
    ),
  );
};

/** Stored values go through the domain rules again: an item that breaks them is corrupt data. */
export const toTransaction = (
  raw: Record<string, unknown>,
): Result<Transaction, PersistenceError> => {
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return err(new PersistenceError(MAPPING_OPERATION, parsed.error));
  }
  const item = parsed.data;

  return ShippingAddress.create(item.shippingAddress)
    .andThen((shippingAddress) =>
      toAmounts(item.amounts).andThen((amounts) =>
        Money.create(item.productSnapshot.unitPriceInCents, item.amounts.currency).map(
          (unitPrice) => ({ shippingAddress, amounts, unitPrice }),
        ),
      ),
    )
    .mapErr((cause) => new PersistenceError(MAPPING_OPERATION, cause))
    .andThen(({ shippingAddress, amounts, unitPrice }) =>
      ok(
        Transaction.restore({
          id: item.transactionId,
          reference: item.reference,
          status: item.status,
          productId: item.productId,
          customerId: item.customerId,
          product: { ...item.productSnapshot, unitPrice },
          quantity: item.quantity,
          shippingAddress,
          amounts,
          delivery: {
            zone: item.zoneCode,
            billableWeightKg: item.billableWeightKg,
            estimatedBusinessDays: item.estimatedBusinessDays,
          },
          payment: item.payment
            ? {
                attemptId: item.payment.attemptId,
                submittedAt: new Date(item.payment.submittedAt),
                installments: item.payment.installments,
                providerTransactionId: item.payment.providerTransactionId ?? null,
                providerStatus: item.payment.providerStatus ?? null,
                statusMessage: item.payment.statusMessage ?? null,
                cardBrand: item.payment.cardBrand ?? null,
                cardLastFour: item.payment.cardLastFour ?? null,
              }
            : null,
          deliveryId: item.deliveryId ?? null,
          reservationExpiresAt: new Date(item.reservationExpiresAt),
          finalizedAt: item.finalizedAt ? new Date(item.finalizedAt) : null,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        }),
      ),
    );
};
