import { aProviderTransaction } from '../../../../../test/builders/provider-transaction.builder';
import { unwrap } from '../../../../../test/builders/unwrap';
import { Money } from '../../../../shared/domain/money.vo';
import type { CardPaymentRequest } from '../../domain/card-payment-request';

import { HttpPaymentGateway } from './http-payment-gateway';

const BASE_URL = 'https://provider.test/v1';
const OPTIONS = {
  baseUrl: BASE_URL,
  publicKey: 'pub_test_key',
  privateKey: 'prv_test_key',
  integritySecret: 'integrity_secret_for_tests',
  timeoutMs: 5000,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const MERCHANT = {
  data: {
    presigned_acceptance: {
      acceptance_token: 'jwt-terms',
      permalink: 'https://provider.test/terms.pdf',
      type: 'END_USER_POLICY',
    },
    presigned_personal_data_auth: {
      acceptance_token: 'jwt-data',
      permalink: 'https://provider.test/personal-data.pdf',
      type: 'PERSONAL_DATA_AUTH',
    },
  },
};

const REQUEST: CardPaymentRequest = {
  reference: 'CKT-20260924-7K3M9Q2PXA',
  amount: unwrap(Money.create(5_090_000)),
  customerEmail: 'ana.gomez@example.com',
  cardToken: 'tok_test_4242',
  installments: 3,
  endUserPolicyToken: 'jwt-terms',
  personalDataAuthToken: 'jwt-data',
  customer: {
    fullName: 'Ana María Gómez',
    phone: '3001234567',
    legalIdType: 'CC',
    legalId: '1020304050',
  },
  shippingAddress: {
    recipientName: 'Ana María Gómez',
    phone: '3001234567',
    addressLine1: 'Calle 100 # 10-20',
    addressLine2: null,
    city: 'Bogotá, D.C.',
    region: 'Bogotá, D.C.',
    postalCode: '110111',
  },
};

const failureOf = async (
  result: PromiseLike<{
    match: <R>(on: { ok: () => R; err: (e: { code: string; context?: unknown }) => R }) => R;
  }>,
) => (await result).match({ ok: () => undefined, err: (error) => error });

describe('HttpPaymentGateway', () => {
  const setup = () => {
    const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    return { fetchMock, gateway: new HttpPaymentGateway(OPTIONS, fetchMock) };
  };
  const call = (fetchMock: jest.Mock, index = 0) => {
    const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
    return { url, init, headers: init.headers as Record<string, string> };
  };

  describe('getAcceptanceTokens', () => {
    it('reads both acceptance tokens and their documents with the public key', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValueOnce(json(MERCHANT));

      expect(unwrap(await gateway.getAcceptanceTokens())).toEqual({
        endUserPolicy: { token: 'jwt-terms', permalink: 'https://provider.test/terms.pdf' },
        personalDataAuth: {
          token: 'jwt-data',
          permalink: 'https://provider.test/personal-data.pdf',
        },
      });
      const { url, headers, init } = call(fetchMock);
      expect(url).toBe(`${BASE_URL}/merchants/info`);
      expect(headers['x-merchant-public-key']).toBe('pub_test_key');
      expect(init.redirect).toBe('error');
    });

    it('falls back to the legacy endpoint when the current one is not found', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json(MERCHANT));

      expect((await gateway.getAcceptanceTokens()).isOk).toBe(true);
      expect(call(fetchMock, 1).url).toBe(`${BASE_URL}/merchants/pub_test_key`);
    });

    it('reports an unexpected body as the provider being unavailable', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValueOnce(json({ data: {} }));

      expect(await failureOf(gateway.getAcceptanceTokens())).toMatchObject({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
      });
    });
  });

  describe('createCardPayment', () => {
    it('sends the signed payment with the private key and maps the pending transaction', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValueOnce(
        json({ data: aProviderTransaction({ status: 'PENDING' }) }, 201),
      );

      const payment = unwrap(await gateway.createCardPayment(REQUEST));

      expect(payment).toEqual({
        providerTransactionId: '15113-1790566893-12345',
        reference: 'CKT-20260924-7K3M9Q2PXA',
        status: 'PENDING',
        amount: unwrap(Money.create(5_090_000)),
        statusMessage: null,
        cardBrand: 'VISA',
        cardLastFour: '4242',
      });
      const { url, init, headers } = call(fetchMock);
      expect(url).toBe(`${BASE_URL}/transactions`);
      expect(init.method).toBe('POST');
      expect(headers.Authorization).toBe('Bearer prv_test_key');
      expect(JSON.parse(init.body as string)).toEqual({
        acceptance_token: 'jwt-terms',
        accept_personal_auth: 'jwt-data',
        amount_in_cents: 5_090_000,
        currency: 'COP',
        signature: 'f9c3500541d5cdbc630b911c698dd0bae5a05f97a28205c464628d036871923c',
        customer_email: 'ana.gomez@example.com',
        reference: 'CKT-20260924-7K3M9Q2PXA',
        payment_method: { type: 'CARD', token: 'tok_test_4242', installments: 3 },
        customer_data: {
          full_name: 'Ana María Gómez',
          phone_number: '573001234567',
          legal_id_type: 'CC',
          legal_id: '1020304050',
        },
        shipping_address: {
          name: 'Ana María Gómez',
          phone_number: '573001234567',
          address_line_1: 'Calle 100 # 10-20',
          city: 'Bogotá, D.C.',
          region: 'Bogotá, D.C.',
          country: 'CO',
          postal_code: '110111',
        },
      });
    });

    it('sends the optional address fields only when present', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValueOnce(json({ data: aProviderTransaction() }, 201));

      await gateway.createCardPayment({
        ...REQUEST,
        shippingAddress: { ...REQUEST.shippingAddress, addressLine2: 'Apto 501', postalCode: null },
      });

      const body = JSON.parse(call(fetchMock).init.body as string) as {
        shipping_address: Record<string, string>;
      };
      expect(body.shipping_address.address_line_2).toBe('Apto 501');
      expect(body.shipping_address).not.toHaveProperty('postal_code');
    });

    it('names the field the provider rejected', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValueOnce(
        json(
          {
            error: {
              type: 'INPUT_VALIDATION_ERROR',
              messages: { acceptance_token: ['El token de aceptación ya fue usado'] },
            },
          },
          422,
        ),
      );

      expect(await failureOf(gateway.createCardPayment(REQUEST))).toMatchObject({
        code: 'PAYMENT_REJECTED_BY_PROVIDER',
        context: { field: 'acceptance_token' },
      });
    });

    it('rejects without a field when the provider does not say which', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));

      expect(await failureOf(gateway.createCardPayment(REQUEST))).toMatchObject({
        code: 'PAYMENT_REJECTED_BY_PROVIDER',
        context: {},
      });
    });

    it.each([
      ['a server error', () => Promise.resolve(json({}, 503)), 'PAYMENT_PROVIDER_UNAVAILABLE'],
      [
        'a network failure',
        () => Promise.reject(new TypeError('fetch failed')),
        'PAYMENT_PROVIDER_UNAVAILABLE',
      ],
      [
        'a timeout',
        () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')),
        'PAYMENT_PROVIDER_TIMEOUT',
      ],
      [
        'an unknown status',
        () => Promise.resolve(json({ data: aProviderTransaction({ status: 'WEIRD' }) })),
        'PAYMENT_PROVIDER_UNAVAILABLE',
      ],
      [
        'an unsupported currency',
        () => Promise.resolve(json({ data: aProviderTransaction({ currency: 'USD' }) })),
        'PAYMENT_PROVIDER_UNAVAILABLE',
      ],
    ])('reports %s', async (_case, respond, code) => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockImplementationOnce(respond);

      expect(await failureOf(gateway.createCardPayment(REQUEST))).toMatchObject({ code });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPayment', () => {
    it('reads the transaction with the public key', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValueOnce(
        json({
          data: aProviderTransaction({
            status: 'DECLINED',
            status_message: 'La transacción fue rechazada (Sandbox)',
            payment_method: null,
          }),
        }),
      );

      expect(unwrap(await gateway.getPayment('15113-1790566893-12345'))).toMatchObject({
        status: 'DECLINED',
        statusMessage: 'La transacción fue rechazada (Sandbox)',
        cardBrand: null,
        cardLastFour: null,
      });
      const { url, headers } = call(fetchMock);
      expect(url).toBe(`${BASE_URL}/transactions/15113-1790566893-12345`);
      expect(headers.Authorization).toBe('Bearer pub_test_key');
    });

    it('retries a read once when the provider fails', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(json({ data: aProviderTransaction() }));

      expect(unwrap(await gateway.getPayment('id')).status).toBe('APPROVED');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up after the second failed read', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValue(json({}, 502));

      expect(await failureOf(gateway.getPayment('id'))).toMatchObject({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('findPaymentByReference', () => {
    it('searches by reference with the private key', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValueOnce(json({ data: [aProviderTransaction()], meta: {} }));

      expect(unwrap(await gateway.findPaymentByReference('CKT-1 A'))?.status).toBe('APPROVED');
      const { url, headers } = call(fetchMock);
      expect(url).toBe(`${BASE_URL}/transactions?reference=CKT-1%20A`);
      expect(headers.Authorization).toBe('Bearer prv_test_key');
    });

    it('answers null when the provider has no payment with that reference', async () => {
      const { fetchMock, gateway } = setup();
      fetchMock.mockResolvedValueOnce(json({ data: [], meta: {} }));

      expect(unwrap(await gateway.findPaymentByReference('CKT-1'))).toBeNull();
    });
  });
});
