import type { Clock } from '../../../shared/domain/clock.port';
import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { err, ok, type Result, type ResultAsync } from '../../../shared/domain/result';
import type { ValidationError } from '../../../shared/domain/validation-error';
import type { CityNotSupportedError } from '../../coverage/domain/coverage.errors';
import type { CoverageRepository } from '../../coverage/domain/coverage.repository.port';
import { findActiveProduct } from '../../products/application/find-active-product';
import type { CatalogPolicy } from '../../products/domain/catalog-policy';
import type { Product } from '../../products/domain/product.entity';
import {
  QuantityLimitExceededError,
  type ProductNotFoundError,
} from '../../products/domain/product.errors';
import type { ProductRepository } from '../../products/domain/product.repository.port';
import type { CheckoutPricingService, PriceBreakdown } from '../domain/checkout-pricing.service';

export interface QuoteCheckoutCommand {
  readonly productId: string;
  readonly quantity: number;
  /** Five-digit DIVIPOLA municipality code of the delivery address. */
  readonly cityCode: string;
}

export interface CheckoutQuote extends PriceBreakdown {
  readonly productId: string;
  readonly quantity: number;
  readonly calculatedAt: Date;
}

export type QuoteCheckoutError =
  | ProductNotFoundError
  | QuantityLimitExceededError
  | CityNotSupportedError
  | ValidationError
  | PersistenceError;

/** Informative quote; the charged total is recalculated when the transaction is created. */
export class QuoteCheckout {
  constructor(
    private readonly products: ProductRepository,
    private readonly coverage: CoverageRepository,
    private readonly pricing: CheckoutPricingService,
    private readonly catalog: CatalogPolicy,
    private readonly clock: Clock,
  ) {}

  execute(command: QuoteCheckoutCommand): ResultAsync<CheckoutQuote, QuoteCheckoutError> {
    return findActiveProduct(this.products, command.productId)
      .andThen((product) => this.ensureQuantity(product, command.quantity))
      .andThen((product) =>
        this.coverage
          .findCity(command.cityCode)
          .andThen((city) => this.pricing.quote(product, command.quantity, city.zone)),
      )
      .map((breakdown) => ({
        ...breakdown,
        productId: command.productId,
        quantity: command.quantity,
        calculatedAt: this.clock.now(),
      }));
  }

  private ensureQuantity(
    product: Product,
    quantity: number,
  ): Result<Product, QuantityLimitExceededError> {
    const limit = product.maxUnitsPerOrder(this.catalog);
    return quantity > limit ? err(new QuantityLimitExceededError(limit)) : ok(product);
  }
}
