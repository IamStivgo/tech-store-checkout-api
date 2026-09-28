import type { Clock } from '../../../shared/domain/clock.port';
import type { IdGenerator } from '../../../shared/domain/id-generator.port';
import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { err, ok, okAsync, ResultAsync, type Result } from '../../../shared/domain/result';
import type { Sleeper } from '../../../shared/domain/sleeper.port';
import type { CoverageRepository } from '../../coverage/domain/coverage.repository.port';
import type { Customer } from '../../customers/domain/customer.entity';
import { CustomerNotFoundError } from '../../customers/domain/customer.errors';
import type { CustomerRepository } from '../../customers/domain/customer.repository.port';
import type { CardPaymentRequest } from '../../payments/domain/card-payment-request';
import {
  PaymentRejectedByProviderError,
  type PaymentGatewayError,
} from '../../payments/domain/payment-gateway.errors';
import type { PaymentGateway } from '../../payments/domain/payment-gateway.port';
import { isFinalPaymentStatus, type ProviderPayment } from '../../payments/domain/provider-payment';
import { claimReleasedEvents, paymentSubmittedEvents } from '../domain/transaction-event';
import type { Transaction } from '../domain/transaction.entity';
import type {
  PaymentAlreadySubmittedError,
  TransactionNotFoundError,
  TransactionNotPayableError,
} from '../domain/transaction.errors';
import type { TransactionRepository } from '../domain/transaction.repository.port';

import type { ApplyPaymentResult } from './apply-payment-result.use-case';
import { findTransaction } from './find-transaction';

export interface ProcessPaymentCommand {
  readonly transactionId: string;
  readonly cardToken: string;
  readonly installments: number;
  readonly acceptanceToken: string;
  readonly personalDataAuthToken: string;
}

export type ProcessPaymentError =
  | TransactionNotFoundError
  | TransactionNotPayableError
  | PaymentAlreadySubmittedError
  | CustomerNotFoundError
  | PaymentGatewayError
  | PersistenceError;

export interface ProcessPaymentDependencies {
  readonly transactions: TransactionRepository;
  readonly customers: CustomerRepository;
  readonly coverage: CoverageRepository;
  readonly gateway: PaymentGateway;
  readonly applyResult: ApplyPaymentResult;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly sleeper: Sleeper;
  /** Waits between reads of a PENDING payment; about 8 s in total (backend design §6.2). */
  readonly pollDelaysMs: readonly number[];
}

/**
 * Sends the payment once, even with concurrent requests (conditional claim), and waits a few
 * seconds for its final result. A result that is still PENDING is answered as such (202) and
 * later settled by the status polling, the webhook or the reconciliation.
 */
export class ProcessPayment {
  constructor(private readonly deps: ProcessPaymentDependencies) {}

  execute(command: ProcessPaymentCommand): ResultAsync<Transaction, ProcessPaymentError> {
    const { transactions, customers, clock, ids } = this.deps;

    return findTransaction(transactions, command.transactionId)
      .andThen((transaction) => transaction.ensurePayable(clock.now()))
      .andThen((transaction) =>
        customers
          .findById(transaction.customerId)
          .andThen((customer) =>
            customer ? ok({ transaction, customer }) : err(new CustomerNotFoundError()),
          ),
      )
      .andThen(({ transaction, customer }) => {
        const claimed = transaction.claimPayment(ids.uuid(), command.installments, clock.now());
        return transactions
          .claimPaymentSubmission(claimed)
          .andThen(() => this.send(claimed, this.paymentRequest(claimed, customer, command)));
      })
      .andThen(({ claimed, payment }) => this.record(claimed, payment))
      .andThen(({ recorded, payment }) => this.settleOrWait(recorded, payment));
  }

  private paymentRequest(
    transaction: Transaction,
    customer: Customer,
    command: ProcessPaymentCommand,
  ): CardPaymentRequest {
    const { shippingAddress: address } = transaction;
    const { coverage } = this.deps;
    const city = coverage.findCity(address.cityCode).match({
      ok: ({ name }) => name,
      err: () => address.cityCode,
    });
    const region =
      coverage.listDepartments().find(({ code }) => code === address.departmentCode)?.name ??
      address.departmentCode;

    return {
      reference: transaction.reference,
      amount: transaction.amounts.total,
      customerEmail: customer.email.value,
      cardToken: command.cardToken,
      installments: command.installments,
      endUserPolicyToken: command.acceptanceToken,
      personalDataAuthToken: command.personalDataAuthToken,
      customer: {
        fullName: customer.fullName.value,
        phone: customer.phone.value,
        legalIdType: customer.legalId.type,
        legalId: customer.legalId.number,
      },
      shippingAddress: {
        recipientName: address.recipientName.value,
        phone: address.phone.value,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city,
        region,
        postalCode: address.postalCode,
      },
    };
  }

  /**
   * A refused payment releases the claim so the buyer can fix the card. When the provider did
   * not answer, it may still have the payment: it is searched by reference before giving up.
   */
  private send(
    claimed: Transaction,
    request: CardPaymentRequest,
  ): ResultAsync<{ claimed: Transaction; payment: ProviderPayment }, ProcessPaymentError> {
    const { gateway } = this.deps;
    return new ResultAsync(
      Promise.resolve(gateway.createCardPayment(request)).then(
        async (created): Promise<Result<ProviderPayment, ProcessPaymentError>> => {
          if (created.isOk) {
            return created;
          }
          if (created.error instanceof PaymentRejectedByProviderError) {
            return this.releaseWith(claimed, created.error);
          }
          const found = await gateway.findPaymentByReference(claimed.reference);
          return found.isOk && found.value
            ? ok(found.value)
            : this.releaseWith(claimed, created.error);
        },
      ),
    ).map((payment) => ({ claimed, payment }));
  }

  private async releaseWith(
    claimed: Transaction,
    error: ProcessPaymentError,
  ): Promise<Result<never, ProcessPaymentError>> {
    const attemptId = claimed.payment?.attemptId ?? '';
    await this.deps.transactions.releasePaymentClaim(
      claimed.id,
      attemptId,
      claimReleasedEvents(claimed, 'CHECKOUT_API', this.deps.clock.now()),
    );
    return err(error);
  }

  private record(
    claimed: Transaction,
    payment: ProviderPayment,
  ): ResultAsync<{ recorded: Transaction; payment: ProviderPayment }, PersistenceError> {
    const recorded = claimed.withProviderPayment(payment, this.deps.clock.now());
    return this.deps.transactions
      .recordProviderPayment(recorded, paymentSubmittedEvents(recorded, 'CHECKOUT_API'))
      .map(() => ({ recorded, payment }));
  }

  private settleOrWait(
    recorded: Transaction,
    payment: ProviderPayment,
  ): ResultAsync<Transaction, PersistenceError | TransactionNotFoundError> {
    if (isFinalPaymentStatus(payment.status)) {
      return this.deps.applyResult
        .execute(recorded, payment, 'SHORT_POLL')
        .map(({ transaction }) => transaction);
    }
    return new ResultAsync(this.pollForResult(payment.providerTransactionId)).andThen((final) =>
      final
        ? this.deps.applyResult
            .execute(recorded, final, 'SHORT_POLL')
            .map(({ transaction }) => transaction)
        : okAsync(recorded),
    );
  }

  // Read errors while polling are not fatal: the payment stays PENDING and is settled later.
  private async pollForResult(
    providerTransactionId: string,
  ): Promise<Result<ProviderPayment | null, never>> {
    for (const delay of this.deps.pollDelaysMs) {
      await this.deps.sleeper.sleep(delay);
      const read = await this.deps.gateway.getPayment(providerTransactionId);
      if (read.isOk && isFinalPaymentStatus(read.value.status)) {
        return ok(read.value);
      }
    }
    return ok(null);
  }
}
