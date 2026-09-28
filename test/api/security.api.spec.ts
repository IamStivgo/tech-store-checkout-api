import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { CUSTOMER_REPOSITORY } from '../../src/modules/customers/infrastructure/customer-repository.token';
import { IDEMPOTENCY_RECORD_REPOSITORY } from '../../src/shared/infrastructure/idempotency/idempotency-record-repository.token';
import { InMemoryCustomerRepository } from '../fakes/in-memory-customer.repository';
import { InMemoryIdempotencyRepository } from '../fakes/in-memory-idempotency.repository';

import { createTestApp } from './create-test-app';

const CUSTOMERS_PATH = '/api/v1/customers';
const KEY = '5b0c1a2e-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
const SIXTEEN_KB = 16 * 1024;

describe('API hardening', () => {
  let app: NestExpressApplication;

  const post = (body: string, contentType?: string) => {
    const call = request(app.getHttpServer())
      .post(CUSTOMERS_PATH)
      .set('Idempotency-Key', KEY)
      .set('X-Request-Id', 'trace-hardening');
    return contentType === undefined
      ? call.send(body)
      : call.set('Content-Type', contentType).send(body);
  };

  beforeEach(async () => {
    app = await createTestApp({
      providers: [
        { provide: CUSTOMER_REPOSITORY, useValue: new InMemoryCustomerRepository() },
        { provide: IDEMPOTENCY_RECORD_REPOSITORY, useValue: new InMemoryIdempotencyRepository() },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('sends the security headers for JSON responses and hides the framework', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.headers).toMatchObject({
      'content-security-policy': "default-src 'none';frame-ancestors 'none'",
      'strict-transport-security': 'max-age=63072000; includeSubDomains',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cross-origin-resource-policy': 'same-origin',
    });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('answers malformed JSON with a 400 problem that carries the request id', async () => {
    const response = await post('{"fullName":', 'application/json');

    expect(response.status).toBe(400);
    expect(response.headers['x-request-id']).toBe('trace-hardening');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.body).toMatchObject({ code: 'BAD_REQUEST', traceId: 'trace-hardening' });
  });

  it('answers a body larger than 16 KB with 413', async () => {
    const response = await post(
      JSON.stringify({ fullName: 'a'.repeat(SIXTEEN_KB) }),
      'application/json',
    );

    expect(response.status).toBe(413);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      detail: 'The request body is too large.',
      traceId: 'trace-hardening',
    });
  });

  it('reads a body just under the limit', async () => {
    const response = await post(
      JSON.stringify({ fullName: 'a'.repeat(SIXTEEN_KB - 100) }),
      'application/json',
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it.each(['text/plain', 'application/x-www-form-urlencoded', 'application/xml'])(
    'answers a %s body with 415',
    async (contentType) => {
      const response = await post('fullName=Ana', contentType);

      expect(response.status).toBe(415);
      expect(response.body).toMatchObject({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        detail: 'The request body must be JSON (application/json).',
        traceId: 'trace-hardening',
      });
    },
  );

  it('accepts JSON with a charset', async () => {
    const response = await post(
      JSON.stringify({ fullName: 'Ana' }),
      'application/json; charset=utf-8',
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('lets a request without a body reach the validation', async () => {
    const response = await request(app.getHttpServer())
      .post(CUSTOMERS_PATH)
      .set('Idempotency-Key', KEY);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'body', message: 'the request body must be a JSON object' }],
    });
  });
});
