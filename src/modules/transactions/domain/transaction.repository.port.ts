import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';

import type { Transaction } from './transaction.entity';
import type { PaymentAlreadySubmittedError } from './transaction.errors';

export interface TransactionRepository {
  findById(id: string): ResultAsync<Transaction | null, PersistenceError>;
  /**
   * Stores the claimed payment only if the transaction is still PENDING, has no payment and its
   * reservation is valid, so two concurrent payments can never both be sent.
   */
  claimPaymentSubmission(
    claimed: Transaction,
  ): ResultAsync<void, PaymentAlreadySubmittedError | PersistenceError>;
  /** Forgets the claim of this attempt when the provider refused or never got the payment. */
  releasePaymentClaim(
    transactionId: string,
    attemptId: string,
  ): ResultAsync<void, PersistenceError>;
  /** Records the provider's data of the payment sent by this attempt. */
  recordProviderPayment(transaction: Transaction): ResultAsync<void, PersistenceError>;
}
