import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';
import type { Delivery } from '../../deliveries/domain/delivery.entity';
import type { ProductNotFoundError } from '../../products/domain/product.errors';

import type { Transaction } from './transaction.entity';
import type { InsufficientStockError } from './transaction.errors';

/** `already-final`: another path (webhook, polling, reconciliation) closed it first. */
export type ApplyOutcome = 'applied' | 'already-final';

/** Writes that change a transaction and the product stock together, all or nothing. */
export interface CheckoutUnitOfWork {
  /** Creates the PENDING transaction and moves its units from available to reserved. */
  reserveStockAndCreate(
    transaction: Transaction,
  ): ResultAsync<void, InsufficientStockError | ProductNotFoundError | PersistenceError>;
  /** Stores the APPROVED transaction, turns its reserved units into sold ones and creates the delivery. */
  approveAndAssignDelivery(
    transaction: Transaction,
    delivery: Delivery,
  ): ResultAsync<ApplyOutcome, PersistenceError>;
  /** Stores a final, non-approved transaction and returns its reserved units to stock. */
  closeAndReleaseStock(transaction: Transaction): ResultAsync<ApplyOutcome, PersistenceError>;
}
