import type { Clock } from '../../../shared/domain/clock.port';
import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { okAsync, ResultAsync } from '../../../shared/domain/result';
import type { PaymentGateway } from '../../payments/domain/payment-gateway.port';
import { isFinalPaymentStatus } from '../../payments/domain/provider-payment';
import type { Transaction } from '../domain/transaction.entity';
import type { TransactionNotFoundError } from '../domain/transaction.errors';
import type { TransactionRepository } from '../domain/transaction.repository.port';

import type { ApplyPaymentResult } from './apply-payment-result.use-case';
import { findTransaction } from './find-transaction';

export interface TransactionSync {
  readonly gateway: PaymentGateway;
  readonly applyResult: ApplyPaymentResult;
  readonly clock: Clock;
  /** The provider is asked about one transaction at most once in this time. */
  readonly minIntervalMs: number;
}

/**
 * Reads a transaction. While its payment is PENDING, it also asks the provider (T-045), so the
 * buyer sees the final result without waiting for the webhook or the reconciliation. A failing
 * provider never fails the read: the stored state is returned.
 */
export class GetTransaction {
  // Per function instance: enough to keep a polling client from flooding the provider.
  private readonly lastSync = new Map<string, number>();

  constructor(
    private readonly transactions: TransactionRepository,
    private readonly sync?: TransactionSync,
  ) {}

  execute(id: string): ResultAsync<Transaction, TransactionNotFoundError | PersistenceError> {
    return findTransaction(this.transactions, id).andThen((transaction) =>
      this.synced(transaction),
    );
  }

  private synced(
    transaction: Transaction,
  ): ResultAsync<Transaction, TransactionNotFoundError | PersistenceError> {
    const providerId = transaction.payment?.providerTransactionId;
    if (
      !this.sync ||
      transaction.status !== 'PENDING' ||
      !providerId ||
      !this.due(transaction.id)
    ) {
      return okAsync(transaction);
    }
    const { gateway, applyResult } = this.sync;
    const next = gateway.getPayment(providerId).match({
      ok: (payment): ResultAsync<Transaction, TransactionNotFoundError | PersistenceError> =>
        isFinalPaymentStatus(payment.status)
          ? applyResult.execute(transaction, payment).map(({ transaction: applied }) => applied)
          : okAsync(transaction),
      err: () => okAsync(transaction),
    });
    return new ResultAsync(next.then((result) => result));
  }

  private due(id: string): boolean {
    const now = this.sync?.clock.now().getTime() ?? 0;
    const last = this.lastSync.get(id);
    if (last !== undefined && now - last < (this.sync?.minIntervalMs ?? 0)) {
      return false;
    }
    this.lastSync.set(id, now);
    return true;
  }
}
