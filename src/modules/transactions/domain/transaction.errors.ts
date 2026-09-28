import { DomainError } from '../../../shared/domain/domain-error';

export class TransactionNotFoundError extends DomainError {
  readonly code = 'TRANSACTION_NOT_FOUND';

  constructor() {
    super('The transaction does not exist.');
  }
}

/** Only a PENDING transaction whose payment was not sent can be cancelled. */
export class TransactionNotCancellableError extends DomainError {
  readonly code = 'TRANSACTION_NOT_CANCELLABLE';

  constructor(status: string) {
    super('The transaction can no longer be cancelled.', { status });
  }
}

/** Another buyer took the units while this order was being placed. */
export class InsufficientStockError extends DomainError {
  readonly code = 'INSUFFICIENT_STOCK';

  constructor(availableUnits: number) {
    super(`Only ${availableUnits} units are available for this product.`, { availableUnits });
  }
}

/** A final transaction, or one whose stock reservation expired, can no longer be paid. */
export class TransactionNotPayableError extends DomainError {
  readonly code = 'TRANSACTION_NOT_PAYABLE';

  constructor(reason: 'FINAL' | 'RESERVATION_EXPIRED', status: string) {
    super('The transaction can no longer be paid.', { reason, status });
  }
}

/** A payment was already sent for this transaction (possibly with another Idempotency-Key). */
export class PaymentAlreadySubmittedError extends DomainError {
  readonly code = 'PAYMENT_ALREADY_SUBMITTED';

  constructor() {
    super('A payment was already sent for this transaction.');
  }
}
