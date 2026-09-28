import type { Delivery } from '../../src/modules/deliveries/domain/delivery.entity';
import { ProductNotFoundError } from '../../src/modules/products/domain/product.errors';
import type {
  ApplyOutcome,
  CheckoutUnitOfWork,
} from '../../src/modules/transactions/domain/checkout-unit-of-work.port';
import type { Transaction } from '../../src/modules/transactions/domain/transaction.entity';
import {
  InsufficientStockError,
  PaymentAlreadySubmittedError,
} from '../../src/modules/transactions/domain/transaction.errors';
import type { TransactionRepository } from '../../src/modules/transactions/domain/transaction.repository.port';
import type { PersistenceError } from '../../src/shared/domain/persistence-error';
import { errAsync, okAsync, type ResultAsync } from '../../src/shared/domain/result';

interface StockCounters {
  available: number;
  reserved: number;
  sold: number;
}

/**
 * Transactions and product stock in memory, with the same all-or-nothing rules as the
 * DynamoDB unit of work: no transaction without its reservation, and final states never change.
 */
export class InMemoryCheckoutStore implements TransactionRepository, CheckoutUnitOfWork {
  readonly transactions = new Map<string, Transaction>();
  readonly stock = new Map<string, StockCounters>();
  readonly deliveries = new Map<string, Delivery>();
  // The transaction as it was before each claim, to undo a released claim.
  private readonly unclaimed = new Map<string, Transaction>();
  private failure: PersistenceError | undefined;

  withStock(productId: string, available: number): this {
    this.stock.set(productId, { available, reserved: 0, sold: 0 });
    return this;
  }

  failWith(error: PersistenceError): this {
    this.failure = error;
    return this;
  }

  findById(id: string): ResultAsync<Transaction | null, PersistenceError> {
    return this.failure ? errAsync(this.failure) : okAsync(this.transactions.get(id) ?? null);
  }

  findPending(limit: number): ResultAsync<Transaction[], PersistenceError> {
    if (this.failure) {
      return errAsync(this.failure);
    }
    const pending = [...this.transactions.values()]
      .filter(({ status }) => status === 'PENDING')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return okAsync(pending.slice(0, limit));
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

  claimPaymentSubmission(
    claimed: Transaction,
  ): ResultAsync<void, PaymentAlreadySubmittedError | PersistenceError> {
    if (this.failure) {
      return errAsync(this.failure);
    }
    const current = this.transactions.get(claimed.id);
    if (current?.status !== 'PENDING' || current.payment) {
      return errAsync(new PaymentAlreadySubmittedError());
    }
    this.unclaimed.set(claimed.id, current);
    this.transactions.set(claimed.id, claimed);
    return okAsync(undefined);
  }

  releasePaymentClaim(
    transactionId: string,
    attemptId: string,
  ): ResultAsync<void, PersistenceError> {
    const before = this.unclaimed.get(transactionId);
    if (before && this.transactions.get(transactionId)?.payment?.attemptId === attemptId) {
      this.transactions.set(transactionId, before);
    }
    return okAsync(undefined);
  }

  recordProviderPayment(transaction: Transaction): ResultAsync<void, PersistenceError> {
    const current = this.transactions.get(transaction.id);
    if (current?.payment?.attemptId === transaction.payment?.attemptId) {
      this.transactions.set(transaction.id, transaction);
    }
    return okAsync(undefined);
  }

  approveAndAssignDelivery(
    transaction: Transaction,
    delivery: Delivery,
  ): ResultAsync<ApplyOutcome, PersistenceError> {
    if (this.transactions.get(transaction.id)?.status !== 'PENDING') {
      return okAsync('already-final');
    }
    const counters = this.stock.get(transaction.productId);
    if (counters) {
      counters.reserved -= transaction.quantity;
      counters.sold += transaction.quantity;
    }
    this.transactions.set(transaction.id, transaction);
    this.deliveries.set(delivery.id, delivery);
    return okAsync('applied');
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
