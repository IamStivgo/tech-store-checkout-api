import type { Clock } from '../../../shared/domain/clock.port';
import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { ok, okAsync, ResultAsync } from '../../../shared/domain/result';
import type { PaymentGatewayError } from '../../payments/domain/payment-gateway.errors';
import type { PaymentGateway } from '../../payments/domain/payment-gateway.port';
import { isFinalPaymentStatus, type ProviderPayment } from '../../payments/domain/provider-payment';
import type { CheckoutUnitOfWork } from '../domain/checkout-unit-of-work.port';
import {
  claimReleasedEvents,
  finalizationEvents,
  paymentSubmittedEvents,
} from '../domain/transaction-event';
import type { Transaction, TransactionPayment } from '../domain/transaction.entity';
import type { TransactionNotFoundError } from '../domain/transaction.errors';
import type { TransactionRepository } from '../domain/transaction.repository.port';

import type { ApplyPaymentResult } from './apply-payment-result.use-case';

export interface ReconciliationSummary {
  /** Reservations that ran out without a payment: stock released. */
  readonly expired: number;
  /** Payments whose final result was applied. */
  readonly synced: number;
  /** Transactions that could not be reconciled in this run (retried in the next one). */
  readonly failed: number;
}

type Outcome = 'expired' | 'synced' | 'unchanged';
type ReconcileError = PaymentGatewayError | PersistenceError | TransactionNotFoundError;

export interface ReconcileTransactionsDeps {
  readonly transactions: TransactionRepository;
  readonly checkout: CheckoutUnitOfWork;
  readonly gateway: PaymentGateway;
  readonly applyResult: ApplyPaymentResult;
  readonly clock: Clock;
  /** PENDING transactions reviewed per run, oldest first. */
  readonly batchSize: number;
  /** A claimed payment the provider still does not know after this long was never sent. */
  readonly lostClaimAfterMs: number;
}

/**
 * Scheduled job (payment flow §7): expires reservations that were never paid and applies the
 * final result of payments that are still PENDING here. One failure never stops the batch.
 */
export class ReconcileTransactions {
  constructor(private readonly deps: ReconcileTransactionsDeps) {}

  execute(): ResultAsync<ReconciliationSummary, PersistenceError> {
    return this.deps.transactions
      .findPending(this.deps.batchSize)
      .andThen((pending) => new ResultAsync(this.reconcileAll(pending).then(ok)));
  }

  // One by one, so a large backlog does not flood the payment provider.
  private async reconcileAll(pending: readonly Transaction[]): Promise<ReconciliationSummary> {
    const counts = { expired: 0, synced: 0, failed: 0 };
    for (const transaction of pending) {
      const result = await this.reconcile(transaction);
      if (result.isErr) {
        counts.failed += 1;
      } else if (result.value !== 'unchanged') {
        counts[result.value] += 1;
      }
    }
    return counts;
  }

  private reconcile(transaction: Transaction): ResultAsync<Outcome, ReconcileError> {
    const now = this.deps.clock.now();
    const { payment } = transaction;
    if (!payment) {
      const expired = transaction.expire(now);
      return expired
        ? this.deps.checkout
            .closeAndReleaseStock(
              expired,
              finalizationEvents(transaction, expired, 'RECONCILIATION'),
            )
            .map((outcome): Outcome => (outcome === 'applied' ? 'expired' : 'unchanged'))
        : okAsync('unchanged');
    }
    return this.lookUp(transaction, payment).andThen((found) =>
      this.follow(transaction, payment, found, now),
    );
  }

  private lookUp(
    transaction: Transaction,
    payment: TransactionPayment,
  ): ResultAsync<ProviderPayment | null, PaymentGatewayError> {
    return payment.providerTransactionId
      ? this.deps.gateway.getPayment(payment.providerTransactionId)
      : this.deps.gateway.findPaymentByReference(transaction.reference);
  }

  private follow(
    transaction: Transaction,
    payment: TransactionPayment,
    found: ProviderPayment | null,
    now: Date,
  ): ResultAsync<Outcome, ReconcileError> {
    if (found && isFinalPaymentStatus(found.status)) {
      return this.deps.applyResult
        .execute(transaction, found, 'RECONCILIATION')
        .map((): Outcome => 'synced');
    }
    if (found) {
      // Still PENDING at the provider: keep its id so the next run asks for it directly.
      const recorded = transaction.withProviderPayment(found, now);
      return this.deps.transactions
        .recordProviderPayment(recorded, paymentSubmittedEvents(recorded, 'RECONCILIATION'))
        .map((): Outcome => 'unchanged');
    }
    const lost = now.getTime() - payment.submittedAt.getTime() >= this.deps.lostClaimAfterMs;
    // The provider never got it: forget the claim, so the reservation can expire.
    return lost
      ? this.deps.transactions
          .releasePaymentClaim(
            transaction.id,
            payment.attemptId,
            claimReleasedEvents(transaction, 'RECONCILIATION', now),
          )
          .map((): Outcome => 'unchanged')
      : okAsync('unchanged');
  }
}
