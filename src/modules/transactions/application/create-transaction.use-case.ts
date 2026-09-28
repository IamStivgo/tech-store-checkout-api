import type { Clock } from '../../../shared/domain/clock.port';
import type { IdGenerator } from '../../../shared/domain/id-generator.port';
import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { err, ok, type Result, type ResultAsync } from '../../../shared/domain/result';
import type { ValidationError } from '../../../shared/domain/validation-error';
import { CityNotSupportedError } from '../../coverage/domain/coverage.errors';
import type { CoverageRepository } from '../../coverage/domain/coverage.repository.port';
import type { City } from '../../coverage/domain/location';
import { CustomerNotFoundError } from '../../customers/domain/customer.errors';
import type { CustomerRepository } from '../../customers/domain/customer.repository.port';
import type { CheckoutPricingService } from '../../pricing/domain/checkout-pricing.service';
import { findActiveProduct } from '../../products/application/find-active-product';
import type { CatalogPolicy } from '../../products/domain/catalog-policy';
import type { Product } from '../../products/domain/product.entity';
import {
  QuantityLimitExceededError,
  type ProductNotFoundError,
} from '../../products/domain/product.errors';
import type { ProductRepository } from '../../products/domain/product.repository.port';
import type { CheckoutUnitOfWork } from '../domain/checkout-unit-of-work.port';
import { ShippingAddress, type ShippingAddressData } from '../domain/shipping-address.vo';
import { creationEvents } from '../domain/transaction-event';
import type { TransactionPolicy } from '../domain/transaction-policy';
import { newTransactionReference } from '../domain/transaction-reference';
import { Transaction } from '../domain/transaction.entity';
import type { InsufficientStockError } from '../domain/transaction.errors';

export interface CreateTransactionCommand {
  readonly productId: string;
  readonly quantity: number;
  readonly customerId: string;
  readonly shippingAddress: ShippingAddressData;
}

export type CreateTransactionError =
  | ValidationError
  | ProductNotFoundError
  | QuantityLimitExceededError
  | CustomerNotFoundError
  | CityNotSupportedError
  | InsufficientStockError
  | PersistenceError;

export interface CreateTransactionDependencies {
  readonly products: ProductRepository;
  readonly customers: CustomerRepository;
  readonly coverage: CoverageRepository;
  readonly pricing: CheckoutPricingService;
  readonly checkout: CheckoutUnitOfWork;
  readonly catalog: CatalogPolicy;
  readonly policy: TransactionPolicy;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/**
 * Creates a PENDING transaction with the amounts computed on the server (never sent by the
 * client) and reserves its stock atomically (BR-08, BR-12).
 */
export class CreateTransaction {
  constructor(private readonly deps: CreateTransactionDependencies) {}

  execute(command: CreateTransactionCommand): ResultAsync<Transaction, CreateTransactionError> {
    const { products, customers } = this.deps;

    return ShippingAddress.create(command.shippingAddress)
      .asyncAndThen((shippingAddress) =>
        findActiveProduct(products, command.productId)
          .andThen((product) => this.ensureQuantity(product, command.quantity))
          .andThen((product) =>
            customers
              .findById(command.customerId)
              .andThen((customer) => (customer ? ok(product) : err(new CustomerNotFoundError()))),
          )
          .andThen((product) =>
            this.findDeliveryCity(shippingAddress).andThen((city) =>
              this.newTransaction(command, product, shippingAddress, city),
            ),
          ),
      )
      .andThen((transaction) =>
        this.deps.checkout
          .reserveStockAndCreate(transaction, creationEvents(transaction, 'CHECKOUT_API'))
          .map(() => transaction),
      );
  }

  private ensureQuantity(
    product: Product,
    quantity: number,
  ): Result<Product, QuantityLimitExceededError> {
    const limit = product.maxUnitsPerOrder(this.deps.catalog);
    return quantity > limit ? err(new QuantityLimitExceededError(limit)) : ok(product);
  }

  // The municipality must belong to the department the buyer chose.
  private findDeliveryCity(address: ShippingAddress): Result<City, CityNotSupportedError> {
    return this.deps.coverage
      .findCity(address.cityCode)
      .andThen((city) =>
        city.departmentCode === address.departmentCode
          ? ok(city)
          : err(new CityNotSupportedError()),
      );
  }

  private newTransaction(
    command: CreateTransactionCommand,
    product: Product,
    shippingAddress: ShippingAddress,
    city: City,
  ): Result<Transaction, ValidationError> {
    const { pricing, policy, ids, clock } = this.deps;
    const now = clock.now();

    return pricing.quote(product, command.quantity, city.zone).andThen((breakdown) =>
      Transaction.create(
        {
          id: ids.uuid(),
          reference: newTransactionReference(policy.referencePrefix, now, ids),
          productId: product.id,
          customerId: command.customerId,
          product: {
            sku: product.sku,
            name: product.name,
            unitPrice: product.price,
            weightGrams: product.weightGrams,
          },
          quantity: command.quantity,
          shippingAddress,
          amounts: {
            productAmount: breakdown.productAmount,
            serviceFee: breakdown.serviceFee,
            deliveryFee: breakdown.deliveryFee,
            total: breakdown.total,
          },
          delivery: {
            zone: breakdown.delivery.zone,
            billableWeightKg: breakdown.delivery.billableWeightKg,
            estimatedBusinessDays: breakdown.delivery.estimatedBusinessDays,
          },
          createdAt: now,
        },
        policy.reservationTtlMinutes,
      ),
    );
  }
}
