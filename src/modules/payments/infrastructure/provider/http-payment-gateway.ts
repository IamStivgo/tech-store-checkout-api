import type { z } from 'zod';

import { err, ok, ResultAsync, type Result } from '../../../../shared/domain/result';
import type { AcceptanceTokens } from '../../domain/acceptance-tokens';
import type { CardPaymentRequest } from '../../domain/card-payment-request';
import {
  PaymentProviderTimeoutError,
  PaymentProviderUnavailableError,
  PaymentRejectedByProviderError,
  type InvalidEventSignatureError,
  type PaymentGatewayError,
} from '../../domain/payment-gateway.errors';
import type { PaymentGateway } from '../../domain/payment-gateway.port';
import type { ProviderPayment } from '../../domain/provider-payment';

import { integritySignature } from './integrity-signature';
import { verifyPaymentEvent, type PaymentEventsOptions } from './payment-event';
import { toProviderPayment } from './provider-payment.mapper';
import {
  merchantResponseSchema,
  providerErrorSchema,
  tokenizationKeyResponseSchema,
  transactionListResponseSchema,
  transactionResponseSchema,
} from './provider-schemas';

export interface HttpPaymentGatewayOptions {
  /** Provider API base URL, e.g. https://<sandbox host>/v1. */
  readonly baseUrl: string;
  readonly publicKey: string;
  readonly privateKey: string;
  readonly integritySecret: string;
  readonly timeoutMs: number;
  readonly events: PaymentEventsOptions;
}

interface CachedKey {
  readonly value: string;
  readonly expiresAt: number;
}

interface ProviderResponse {
  readonly status: number;
  readonly body: unknown;
}

type Fetch = typeof fetch;

const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const HTTP_SERVER_ERROR = 500;
const COLOMBIA_PHONE_PREFIX = '57';
// Reads are safe to repeat once when the provider fails or is slow.
const READ_ATTEMPTS = 2;
// The tokenization key rarely changes: one download per hour and function instance.
const TOKENIZATION_KEY_TTL_MS = 3_600_000;

const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const rejectedField = (body: unknown): string | undefined => {
  const parsed = providerErrorSchema.safeParse(body);
  return parsed.success ? Object.keys(parsed.data.error.messages ?? {})[0] : undefined;
};

/** Payment provider REST API (sandbox), with timeouts and validation of every answer. */
export class HttpPaymentGateway implements PaymentGateway {
  private tokenizationKey: CachedKey | undefined;

  constructor(
    private readonly options: HttpPaymentGatewayOptions,
    private readonly fetchFn: Fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, PaymentGatewayError> {
    return new ResultAsync(this.fetchAcceptanceTokens());
  }

  getTokenizationKey(): ResultAsync<string, PaymentGatewayError> {
    const cached = this.tokenizationKey;
    if (cached && cached.expiresAt > this.now()) {
      return new ResultAsync(Promise.resolve(ok(cached.value)));
    }
    return new ResultAsync(
      this.read('/tokens/keys/tokenization', this.options.publicKey).then((response) =>
        response
          .andThen((received) => this.parse(received, tokenizationKeyResponseSchema))
          .map(({ data }) => {
            this.tokenizationKey = {
              value: data.publicKey,
              expiresAt: this.now() + TOKENIZATION_KEY_TTL_MS,
            };
            return data.publicKey;
          }),
      ),
    );
  }

  parsePaymentEvent(event: unknown): Result<ProviderPayment | null, InvalidEventSignatureError> {
    return verifyPaymentEvent(event, this.options.events);
  }

  createCardPayment(
    request: CardPaymentRequest,
  ): ResultAsync<ProviderPayment, PaymentGatewayError> {
    const body = {
      acceptance_token: request.endUserPolicyToken,
      accept_personal_auth: request.personalDataAuthToken,
      amount_in_cents: request.amount.amountInCents,
      currency: request.amount.currency,
      signature: integritySignature(
        request.reference,
        request.amount,
        this.options.integritySecret,
      ),
      customer_email: request.customerEmail,
      reference: request.reference,
      payment_method: {
        type: 'CARD',
        token: request.cardToken,
        installments: request.installments,
      },
      customer_data: {
        full_name: request.customer.fullName,
        phone_number: `${COLOMBIA_PHONE_PREFIX}${request.customer.phone}`,
        legal_id_type: request.customer.legalIdType,
        legal_id: request.customer.legalId,
      },
      shipping_address: {
        name: request.shippingAddress.recipientName,
        phone_number: `${COLOMBIA_PHONE_PREFIX}${request.shippingAddress.phone}`,
        address_line_1: request.shippingAddress.addressLine1,
        ...(request.shippingAddress.addressLine2
          ? { address_line_2: request.shippingAddress.addressLine2 }
          : {}),
        city: request.shippingAddress.city,
        region: request.shippingAddress.region,
        country: 'CO',
        ...(request.shippingAddress.postalCode
          ? { postal_code: request.shippingAddress.postalCode }
          : {}),
      },
    };

    return new ResultAsync(
      this.request('POST', '/transactions', { key: this.options.privateKey, body }).then(
        (response) =>
          response
            .andThen((received) => this.parse(received, transactionResponseSchema))
            .andThen(({ data }) => toProviderPayment(data)),
      ),
    );
  }

  getPayment(providerTransactionId: string): ResultAsync<ProviderPayment, PaymentGatewayError> {
    return new ResultAsync(
      this.read(
        `/transactions/${encodeURIComponent(providerTransactionId)}`,
        this.options.publicKey,
      ).then((response) =>
        response
          .andThen((received) => this.parse(received, transactionResponseSchema))
          .andThen(({ data }) => toProviderPayment(data)),
      ),
    );
  }

  findPaymentByReference(
    reference: string,
  ): ResultAsync<ProviderPayment | null, PaymentGatewayError> {
    return new ResultAsync(
      this.read(
        `/transactions?reference=${encodeURIComponent(reference)}`,
        this.options.privateKey,
      ).then((response) =>
        response
          .andThen((received) => this.parse(received, transactionListResponseSchema))
          .andThen(({ data }) => {
            const [transaction] = data;
            return transaction ? toProviderPayment(transaction) : ok(null);
          }),
      ),
    );
  }

  private async fetchAcceptanceTokens(): Promise<Result<AcceptanceTokens, PaymentGatewayError>> {
    const current = await this.request('GET', '/merchants/info', {
      headers: { 'x-merchant-public-key': this.options.publicKey },
    });
    // The legacy endpoint answers the same data until the provider retires it.
    const response =
      current.isOk && current.value.status === HTTP_NOT_FOUND
        ? await this.request('GET', `/merchants/${encodeURIComponent(this.options.publicKey)}`)
        : current;

    return response
      .andThen((received) => this.parse(received, merchantResponseSchema))
      .map(({ data }) => ({
        endUserPolicy: {
          token: data.presigned_acceptance.acceptance_token,
          permalink: data.presigned_acceptance.permalink,
        },
        personalDataAuth: {
          token: data.presigned_personal_data_auth.acceptance_token,
          permalink: data.presigned_personal_data_auth.permalink,
        },
      }));
  }

  private async read(
    path: string,
    key: string,
  ): Promise<Result<ProviderResponse, PaymentGatewayError>> {
    let response = await this.request('GET', path, { key });
    for (let attempt = 1; attempt < READ_ATTEMPTS && this.shouldRetry(response); attempt += 1) {
      response = await this.request('GET', path, { key });
    }
    return response;
  }

  private shouldRetry(response: Result<ProviderResponse, PaymentGatewayError>): boolean {
    return response.isErr || response.value.status >= HTTP_SERVER_ERROR;
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    {
      key,
      body,
      headers = {},
    }: { key?: string; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<Result<ProviderResponse, PaymentGatewayError>> {
    try {
      const response = await this.fetchFn(`${this.options.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs),
        redirect: 'error',
      });
      return ok({ status: response.status, body: await readBody(response) });
    } catch (cause) {
      return err(
        cause instanceof DOMException && cause.name === 'TimeoutError'
          ? new PaymentProviderTimeoutError()
          : new PaymentProviderUnavailableError(cause),
      );
    }
  }

  private parse<T>(
    response: ProviderResponse,
    schema: z.ZodType<T>,
  ): Result<T, PaymentGatewayError> {
    if (response.status >= HTTP_SERVER_ERROR) {
      return err(new PaymentProviderUnavailableError(`HTTP ${response.status}`));
    }
    if (response.status >= HTTP_BAD_REQUEST) {
      return err(new PaymentRejectedByProviderError(rejectedField(response.body)));
    }
    const parsed = schema.safeParse(response.body);
    return parsed.success
      ? ok(parsed.data)
      : err(new PaymentProviderUnavailableError(parsed.error));
  }
}
