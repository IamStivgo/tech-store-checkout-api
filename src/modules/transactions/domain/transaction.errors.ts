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
