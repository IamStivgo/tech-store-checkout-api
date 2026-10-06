import type { ProviderPayment } from '../../payments/domain/provider-payment';

import type { TransactionStatus } from './transaction-status';
import type { Transaction } from './transaction.entity';

export const TRANSACTION_EVENT_TYPES = [
  'TRANSACTION_CREATED',
  'STOCK_RESERVED',
  'STOCK_CONFIRMED',
  'STOCK_RELEASED',
  'PAYMENT_SUBMITTED',
  'PAYMENT_CLAIM_RELEASED',
  'STATUS_CHANGED',
  'DELIVERY_ASSIGNED',
  'WEBHOOK_RECEIVED',
  'RESULT_MISMATCH',
] as const;

export type TransactionEventType = (typeof TRANSACTION_EVENT_TYPES)[number];

/** The path that caused the event (ADR-012). */
export const TRANSACTION_EVENT_SOURCES = [
  'CHECKOUT_API',
  'SHORT_POLL',
  'STATUS_SYNC',
  'WEBHOOK',
  'RECONCILIATION',
] as const;

export type TransactionEventSource = (typeof TRANSACTION_EVENT_SOURCES)[number];

/**
 * One entry of the immutable audit trail of a transaction (ADR-012). Never personal data, card
 * or acceptance tokens: only ids, statuses and amounts. Persistence adds its id and request id.
 */
export interface TransactionEvent {
  readonly transactionId: string;
  readonly type: TransactionEventType;
  readonly source: TransactionEventSource;
  readonly occurredAt: Date;
  readonly fromStatus?: TransactionStatus;
  readonly toStatus?: TransactionStatus;
  readonly providerTransactionId?: string;
  readonly providerStatus?: string;
  readonly amountInCents?: number;
  readonly details?: Readonly<Record<string, string | number>>;
}

const event = (
  transaction: Transaction,
  type: TransactionEventType,
  source: TransactionEventSource,
  occurredAt: Date,
  fields: Partial<TransactionEvent> = {},
): TransactionEvent => ({ transactionId: transaction.id, type, source, occurredAt, ...fields });

const providerFields = ({ payment }: Transaction): Partial<TransactionEvent> => ({
  ...(payment?.providerTransactionId
    ? { providerTransactionId: payment.providerTransactionId }
    : {}),
  ...(payment?.providerStatus ? { providerStatus: payment.providerStatus } : {}),
});

const vatDetails = ({ amounts }: Transaction): Partial<TransactionEvent> =>
  amounts.vat
    ? {
        details: {
          vatRatePercent: amounts.vat.ratePercent,
          vatBaseInCents: amounts.vat.base.amountInCents,
          vatAmountInCents: amounts.vat.amount.amountInCents,
        },
      }
    : {};

/** A new PENDING transaction and the units it reserved. */
export const creationEvents = (
  transaction: Transaction,
  source: TransactionEventSource,
): TransactionEvent[] => [
  event(transaction, 'TRANSACTION_CREATED', source, transaction.createdAt, {
    toStatus: transaction.status,
    amountInCents: transaction.amounts.total.amountInCents,
    ...vatDetails(transaction),
  }),
  event(transaction, 'STOCK_RESERVED', source, transaction.createdAt, {
    details: { quantity: transaction.quantity },
  }),
];

/** The payment reached the provider (it now has the provider's id). */
export const paymentSubmittedEvents = (
  transaction: Transaction,
  source: TransactionEventSource,
): TransactionEvent[] => [
  event(transaction, 'PAYMENT_SUBMITTED', source, transaction.updatedAt, {
    ...providerFields(transaction),
    amountInCents: transaction.amounts.total.amountInCents,
  }),
];

/** The provider refused the payment or never got it: the transaction can be paid again. */
export const claimReleasedEvents = (
  transaction: Transaction,
  source: TransactionEventSource,
  now: Date,
): TransactionEvent[] => [event(transaction, 'PAYMENT_CLAIM_RELEASED', source, now)];

/**
 * A PENDING transaction became final: its new status, what happened to the stock and, when
 * approved, the delivery. A result that did not match the transaction is recorded as well.
 */
export const finalizationEvents = (
  before: Transaction,
  after: Transaction,
  source: TransactionEventSource,
  { mismatch = false }: { readonly mismatch?: boolean } = {},
): TransactionEvent[] => {
  const at = after.finalizedAt ?? after.updatedAt;
  const quantity = { quantity: after.quantity };
  const approved = after.status === 'APPROVED';
  return [
    ...(mismatch
      ? [
          event(after, 'RESULT_MISMATCH', source, at, {
            ...providerFields(after),
            amountInCents: after.amounts.total.amountInCents,
          }),
        ]
      : []),
    event(after, 'STATUS_CHANGED', source, at, {
      fromStatus: before.status,
      toStatus: after.status,
      ...providerFields(after),
    }),
    event(after, approved ? 'STOCK_CONFIRMED' : 'STOCK_RELEASED', source, at, {
      details: quantity,
    }),
    ...(approved && after.deliveryId
      ? [
          event(after, 'DELIVERY_ASSIGNED', source, at, {
            details: { deliveryId: after.deliveryId },
          }),
        ]
      : []),
  ];
};

/** A verified provider event about this transaction, whether it changed it or not. */
export const webhookReceivedEvents = (
  transaction: Transaction,
  payment: ProviderPayment,
  outcome: 'applied' | 'already-final',
  now: Date,
): TransactionEvent[] => [
  event(transaction, 'WEBHOOK_RECEIVED', 'WEBHOOK', now, {
    providerTransactionId: payment.providerTransactionId,
    providerStatus: payment.status,
    details: { result: outcome },
  }),
];
