import { DomainError } from '../../src/shared/domain/domain-error';

export class FakeInsufficientStockError extends DomainError {
  readonly code = 'INSUFFICIENT_STOCK';

  constructor(availableUnits: number) {
    super(`Only ${availableUnits} units are available for this product.`, { availableUnits });
  }
}

export class FakeProductNotFoundError extends DomainError {
  readonly code = 'PRODUCT_NOT_FOUND';

  constructor() {
    super('The product does not exist.');
  }
}

export class FakeProviderUnavailableError extends DomainError {
  readonly code = 'PAYMENT_PROVIDER_UNAVAILABLE';

  constructor() {
    super('The payment provider is not available. Try again in a few minutes.');
  }
}
