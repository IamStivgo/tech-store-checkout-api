import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { errAsync, okAsync, type ResultAsync } from '../../../shared/domain/result';
import type { InvalidEventSignatureError } from '../../payments/domain/payment-gateway.errors';
import type { PaymentGateway } from '../../payments/domain/payment-gateway.port';
import { isFinalPaymentStatus } from '../../payments/domain/provider-payment';
import type { TransactionNotFoundError } from '../domain/transaction.errors';
import type { TransactionRepository } from '../domain/transaction.repository.port';

import type { ApplyPaymentResult } from './apply-payment-result.use-case';

/** `ignored`: valid, but about nothing of this store (other environment, unknown reference). */
export type PaymentEventOutcome = 'applied' | 'ignored';

export type HandlePaymentEventError =
  InvalidEventSignatureError | PersistenceError | TransactionNotFoundError;

/**
 * Webhook of the payment provider (T-046): a verified final result is applied like the one read
 * by the payment, the status sync or the reconciliation. Unknown references are acknowledged, so
 * the provider does not retry them.
 */
export class HandlePaymentEvent {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly gateway: PaymentGateway,
    private readonly applyResult: ApplyPaymentResult,
  ) {}

  execute(event: unknown): ResultAsync<PaymentEventOutcome, HandlePaymentEventError> {
    const parsed = this.gateway.parsePaymentEvent(event);
    if (parsed.isErr) {
      return errAsync(parsed.error);
    }
    const payment = parsed.value;
    if (!payment || !isFinalPaymentStatus(payment.status)) {
      return okAsync('ignored');
    }
    return this.transactions
      .findByReference(payment.reference)
      .andThen((transaction) =>
        transaction
          ? this.applyResult.execute(transaction, payment).map((): PaymentEventOutcome => 'applied')
          : okAsync<PaymentEventOutcome>('ignored'),
      );
  }
}
