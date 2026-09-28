import { errAsync, okAsync, type Result, type ResultAsync } from '../../../../shared/domain/result';
import type { AcceptanceTokens } from '../../domain/acceptance-tokens';
import type { CardPaymentRequest } from '../../domain/card-payment-request';
import {
  PaymentRejectedByProviderError,
  type InvalidEventSignatureError,
  type PaymentGatewayError,
} from '../../domain/payment-gateway.errors';
import type { PaymentGateway } from '../../domain/payment-gateway.port';
import type { ProviderPayment, ProviderPaymentStatus } from '../../domain/provider-payment';
import { verifyPaymentEvent } from '../provider/payment-event';

export const FAKE_APPROVED_TOKEN_PREFIX = 'tok_fake_approved_';
export const FAKE_DECLINED_TOKEN_PREFIX = 'tok_fake_declined_';
const FAKE_DOCUMENTS_URL = 'https://example.com/legal';
const FAKE_TOKENIZATION_KEY = '-----BEGIN PUBLIC KEY----- fake -----END PUBLIC KEY-----';
export const FAKE_EVENTS = { secret: 'fake-events-secret', environment: 'test' };

const outcomeFor = (cardToken: string): ProviderPaymentStatus => {
  if (cardToken.startsWith(FAKE_APPROVED_TOKEN_PREFIX)) {
    return 'APPROVED';
  }
  return cardToken.startsWith(FAKE_DECLINED_TOKEN_PREFIX) ? 'DECLINED' : 'ERROR';
};

/**
 * In-memory payment provider for local runs, tests and Docker (ADR-011); the configuration
 * rejects it in prod. Like the real one, a payment starts PENDING and is final when read again:
 * `tok_fake_approved_*` → APPROVED, `tok_fake_declined_*` → DECLINED, any other token → ERROR.
 */
export class FakePaymentGateway implements PaymentGateway {
  private readonly payments = new Map<
    string,
    { readonly payment: ProviderPayment; readonly outcome: ProviderPaymentStatus }
  >();
  private issuedTokens = 0;

  // Only the JWE tokenizer uses it, and never against the fake gateway (ADR-011).
  getTokenizationKey(): ResultAsync<string, PaymentGatewayError> {
    return okAsync(FAKE_TOKENIZATION_KEY);
  }

  // Local and Docker only: events signed with a known secret, for the webhook by hand.
  parsePaymentEvent(event: unknown): Result<ProviderPayment | null, InvalidEventSignatureError> {
    return verifyPaymentEvent(event, FAKE_EVENTS);
  }

  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, PaymentGatewayError> {
    this.issuedTokens += 1;
    return okAsync({
      endUserPolicy: {
        // JWT-shaped, like the provider's tokens, so they pass the API validation.
        token: `fake.endUserPolicy.${this.issuedTokens}`,
        permalink: `${FAKE_DOCUMENTS_URL}/terms.pdf`,
      },
      personalDataAuth: {
        token: `fake.personalDataAuth.${this.issuedTokens}`,
        permalink: `${FAKE_DOCUMENTS_URL}/personal-data.pdf`,
      },
    });
  }

  createCardPayment(
    request: CardPaymentRequest,
  ): ResultAsync<ProviderPayment, PaymentGatewayError> {
    const usedReference = [...this.payments.values()].some(
      ({ payment }) => payment.reference === request.reference,
    );
    if (usedReference) {
      return errAsync(new PaymentRejectedByProviderError('reference'));
    }

    const payment: ProviderPayment = {
      providerTransactionId: `fake-${this.payments.size + 1}`,
      reference: request.reference,
      status: 'PENDING',
      amount: request.amount,
      statusMessage: null,
      cardBrand: 'VISA',
      cardLastFour: '4242',
    };
    this.payments.set(payment.providerTransactionId, {
      payment,
      outcome: outcomeFor(request.cardToken),
    });
    return okAsync(payment);
  }

  getPayment(providerTransactionId: string): ResultAsync<ProviderPayment, PaymentGatewayError> {
    const payment = this.settle(providerTransactionId);
    return payment ? okAsync(payment) : errAsync(new PaymentRejectedByProviderError('id'));
  }

  findPaymentByReference(
    reference: string,
  ): ResultAsync<ProviderPayment | null, PaymentGatewayError> {
    const record = [...this.payments.values()].find(
      ({ payment }) => payment.reference === reference,
    );
    return okAsync(record ? this.settle(record.payment.providerTransactionId) : null);
  }

  // Reading a payment finishes it, as the real provider does within about a second.
  private settle(providerTransactionId: string): ProviderPayment | null {
    const record = this.payments.get(providerTransactionId);
    if (!record) {
      return null;
    }
    return {
      ...record.payment,
      status: record.outcome,
      statusMessage: record.outcome === 'DECLINED' ? 'Declined by the fake payment provider' : null,
    };
  }
}
