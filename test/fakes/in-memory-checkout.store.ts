import { ProductNotFoundError } from '../../src/modules/products/domain/product.errors';
import type {
  ApplyOutcome,
  CheckoutUnitOfWork,
} from '../../src/modules/transactions/domain/checkout-unit-of-work.port';
import type { Transaction } from '../../src/modules/transactions/domain/transaction.entity';
import { InsufficientStockError } from '../../src/modules/transactions/domain/transaction.errors';
import type { TransactionRepository } from '../../src/modules/transactions/domain/transaction.repository.port';
import type { PersistenceError } from '../../src/shared/domain/persistence-error';
import { errAsync, okAsync, type ResultAsync } from '../../src/shared/domain/result';

interface StockCounters {
  available: number;
  reserved: number;
}

/**
 * Transactions and product stock in memory, with the same all-or-nothing rules as the
 * DynamoDB unit of work: no transaction without its reservation, and final states never change.
 */
export class InMemoryCheckoutStore implements TransactionRepository, CheckoutUnitOfWork {
  readonly transactions = new Map<string, Transaction>();
  readonly stock = new Map<string, StockCounters>();
  private failure: PersistenceError | undefined;

  withStock(productId: string, available: number): this {
    this.stock.set(productId, { available, reserved: 0 });
    return this;
  }

  failWith(error: PersistenceError): this {
    this.failure = error;
    return this;
  }

  findById(id: string): ResultAsync<Transaction | null, PersistenceError> {
    return this.failure ? errAsync(this.failure) : okAsync(this.transactions.get(id) ?? null);
  }

  reserveStockAndCreate(
    transaction: Transaction,
  ): ResultAsync<void, InsufficientStockError | ProductNotFoundError | PersistenceError> {
    if (this.failure) {
      return errAsync(this.failure);
    }
    const counters = this.stock.get(transaction.productId);
    if (!counters) {
      return errAsync(new ProductNotFoundError());
    }
    if (counters.available < transaction.quantity) {
      return errAsync(new InsufficientStockError(counters.available));
    }
    counters.available -= transaction.quantity;
    counters.reserved += transaction.quantity;
    this.transactions.set(transaction.id, transaction);
    return okAsync(undefined);
  }

  closeAndReleaseStock(transaction: Transaction): ResultAsync<ApplyOutcome, PersistenceError> {
    if (this.failure) {
      return errAsync(this.failure);
    }
    if (this.transactions.get(transaction.id)?.status !== 'PENDING') {
      return okAsync('already-final');
    }
    const counters = this.stock.get(transaction.productId);
    if (counters) {
      counters.available += transaction.quantity;
      counters.reserved -= transaction.quantity;
    }
    this.transactions.set(transaction.id, transaction);
    return okAsync('applied');
  }
}
