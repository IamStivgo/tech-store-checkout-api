import { Money } from '../../../../shared/domain/money.vo';
import type { Result } from '../../../../shared/domain/result';
import {
  PaymentProviderUnavailableError,
  type PaymentGatewayError,
} from '../../domain/payment-gateway.errors';
import type { ProviderPayment } from '../../domain/provider-payment';

import type { ProviderTransaction } from './provider-schemas';

/** A provider transaction as the domain sees it; an invalid amount means a broken answer. */
export const toProviderPayment = (
  transaction: ProviderTransaction,
): Result<ProviderPayment, PaymentGatewayError> =>
  Money.create(transaction.amount_in_cents, transaction.currency)
    .map((amount) => ({
      providerTransactionId: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
      amount,
      statusMessage: transaction.status_message ?? null,
      cardBrand: transaction.payment_method?.extra?.brand ?? null,
      cardLastFour: transaction.payment_method?.extra?.last_four ?? null,
    }))
    .mapErr((cause) => new PaymentProviderUnavailableError(cause));
