/** Business rules of new transactions (business rules §7). */
export interface TransactionPolicy {
  /** Minutes the stock stays reserved while the payment is not sent (BR-08). */
  readonly reservationTtlMinutes: number;
  /** First part of the transaction reference (BR-11), e.g. CKT. */
  readonly referencePrefix: string;
}
