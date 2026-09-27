import { DomainError } from '../../../shared/domain/domain-error';

export class ProductNotFoundError extends DomainError {
  readonly code = 'PRODUCT_NOT_FOUND';

  constructor() {
    super('The product does not exist or is no longer available.');
  }
}

/** More units than the product allows per order: min(available stock, order limit) (BR-07). */
export class QuantityLimitExceededError extends DomainError {
  readonly code = 'QUANTITY_LIMIT_EXCEEDED';

  constructor(maxUnitsPerOrder: number) {
    super(`You can buy up to ${maxUnitsPerOrder} units of this product.`, { maxUnitsPerOrder });
  }
}
