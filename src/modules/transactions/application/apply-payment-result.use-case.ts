import type { Clock } from '../../../shared/domain/clock.port';
import type { IdGenerator } from '../../../shared/domain/id-generator.port';
import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { okAsync, type ResultAsync } from '../../../shared/domain/result';
import { Delivery } from '../../deliveries/domain/delivery.entity';
import type { ProviderPayment } from '../../payments/domain/provider-payment';
import type { CheckoutUnitOfWork } from '../domain/checkout-unit-of-work.port';
import type { Transaction } from '../domain/transaction.entity';
import type { TransactionNotFoundError } from '../domain/transaction.errors';
import type { TransactionRepository } from '../domain/transaction.repository.port';

import { findTransaction } from './find-transaction';

export interface AppliedResult {
  /** The transaction as stored after applying (or as another path left it). */
  readonly transaction: Transaction;
  /** The result named another reference or amount: log it as a security alert. */
  readonly mismatch: boolean;
}

/**
 * Applies a final provider result (payment flow §6). An approved payment confirms the sold units
 * and assigns the delivery; any other result returns the units to stock. Safe to run from the
 * payment request, the status polling, the webhook and the reconciliation at the same time.
 */
export class ApplyPaymentResult {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly checkout: CheckoutUnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  execute(
    transaction: Transaction,
    payment: ProviderPayment,
  ): ResultAsync<AppliedResult, PersistenceError | TransactionNotFoundError> {
    const now = this.clock.now();
    const settlement = transaction.settle(payment, now, this.ids.uuid());
    if (settlement.kind === 'already-final') {
      return okAsync({ transaction, mismatch: false });
    }

    const { transaction: settled, mismatch } = settlement;
    const write =
      settled.status === 'APPROVED' && settled.deliveryId
        ? this.checkout.approveAndAssignDelivery(
            settled,
            Delivery.assignFor(settled, settled.deliveryId, now),
          )
        : this.checkout.closeAndReleaseStock(settled);

    return write.andThen((outcome) =>
      outcome === 'applied'
        ? okAsync({ transaction: settled, mismatch })
        : findTransaction(this.transactions, settled.id).map((current) => ({
            transaction: current,
            mismatch: false,
          })),
    );
  }
}
