export const TRANSACTION_STATUSES = [
  'PENDING',
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR',
  'CANCELLED',
  'EXPIRED',
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Every status but PENDING is final and never changes again (payment flow §3.1). */
export const isFinalStatus = (status: TransactionStatus): boolean => status !== 'PENDING';
