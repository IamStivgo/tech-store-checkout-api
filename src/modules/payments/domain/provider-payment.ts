import type { Money } from '../../../shared/domain/money.vo';

export const PROVIDER_PAYMENT_STATUSES = [
  'PENDING',
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR',
] as const;

export type ProviderPaymentStatus = (typeof PROVIDER_PAYMENT_STATUSES)[number];

/** A card payment as the payment provider reports it, normalized for the domain. */
export interface ProviderPayment {
  readonly providerTransactionId: string;
  readonly reference: string;
  readonly status: ProviderPaymentStatus;
  readonly amount: Money;
  readonly statusMessage: string | null;
  readonly cardBrand: string | null;
  readonly cardLastFour: string | null;
}

/** Every status but PENDING is final: the provider never changes it again. */
export const isFinalPaymentStatus = (status: ProviderPaymentStatus): boolean =>
  status !== 'PENDING';
