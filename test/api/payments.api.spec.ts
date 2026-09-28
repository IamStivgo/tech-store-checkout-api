import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { PaymentProviderUnavailableError } from '../../src/modules/payments/domain/payment-gateway.errors';
import { FakePaymentGateway } from '../../src/modules/payments/infrastructure/fake/fake-payment-gateway';
import type { AcceptanceTokensResponse } from '../../src/modules/payments/infrastructure/http/acceptance-tokens.response';
import { PAYMENT_GATEWAY } from '../../src/modules/payments/infrastructure/payment-gateway.token';
import { errAsync } from '../../src/shared/domain/result';

import { createTestApp } from './create-test-app';

describe('Payments API', () => {
  let app: NestExpressApplication;
  const gateway = new FakePaymentGateway();

  beforeAll(async () => {
    app = await createTestApp({ providers: [{ provide: PAYMENT_GATEWAY, useValue: gateway }] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns fresh, never cached acceptance tokens with their documents', async () => {
    const first = await request(app.getHttpServer()).get('/api/v1/payments/acceptance-tokens');
    const second = await request(app.getHttpServer()).get('/api/v1/payments/acceptance-tokens');

    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('no-store');
    const tokens = first.body as AcceptanceTokensResponse;
    expect(tokens.endUserPolicy.permalink).toBe('https://example.com/legal/terms.pdf');
    expect(tokens.personalDataAuth.permalink).toBe('https://example.com/legal/personal-data.pdf');
    expect(tokens.endUserPolicy.acceptanceToken).not.toBe('');
    expect(second.body).not.toEqual(first.body);
  });

  it('serves the key to encrypt the card, cacheable for an hour', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/payments/tokenization-key');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=3600');
    expect(response.body).toEqual({ publicKey: expect.stringContaining('PUBLIC KEY') as string });
  });

  it('answers 502 when the payment provider is not available', async () => {
    jest
      .spyOn(gateway, 'getAcceptanceTokens')
      .mockReturnValueOnce(errAsync(new PaymentProviderUnavailableError()));

    const response = await request(app.getHttpServer()).get('/api/v1/payments/acceptance-tokens');

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({ code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
  });
});
