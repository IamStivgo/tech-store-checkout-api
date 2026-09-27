import { Body, Controller, Post, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { PersistenceError } from '../../src/shared/domain/persistence-error';
import { errAsync } from '../../src/shared/domain/result';
import { Idempotent } from '../../src/shared/infrastructure/http/idempotent.decorator';
import { createOpenApiDocument } from '../../src/shared/infrastructure/http/openapi/openapi-document';
import { hashRequestBody } from '../../src/shared/infrastructure/http/request-hash';
import { toHttpResponse } from '../../src/shared/infrastructure/http/to-http-response';
import { IDEMPOTENCY_RECORD_REPOSITORY } from '../../src/shared/infrastructure/idempotency/idempotency-record-repository.token';
import { FakeInsufficientStockError } from '../fakes/fake-domain-errors';
import { InMemoryIdempotencyRepository } from '../fakes/in-memory-idempotency.repository';

import { createTestApp } from './create-test-app';

const KEY = '5b0c1a2e-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
const ORDERS_PATH = '/api/v1/test-idempotency/orders';
const REJECTIONS_PATH = '/api/v1/test-idempotency/rejections';
const FAILURES_PATH = '/api/v1/test-idempotency/failures';

let executions = 0;

@Controller('test-idempotency')
class IdempotentTestController {
  @Post('orders')
  @Idempotent()
  create(@Body() body: Record<string, unknown>): Record<string, unknown> {
    executions += 1;
    return { orderNumber: executions, ...body };
  }

  @Post('rejections')
  @Idempotent()
  reject(): Promise<never> {
    executions += 1;
    return toHttpResponse(errAsync(new FakeInsufficientStockError(2)));
  }

  @Post('failures')
  @Idempotent()
  fail(): never {
    executions += 1;
    throw new Error('connection reset');
  }
}

const storageFailure = () => errAsync(new PersistenceError('idempotency.test', new Error('down')));

describe('Idempotent endpoints', () => {
  let app: INestApplication<App>;
  const records = new InMemoryIdempotencyRepository();

  const post = (path: string, key: string | undefined, body: object = { quantity: 1 }) => {
    const call = request(app.getHttpServer()).post(path).send(body);
    return key === undefined ? call : call.set('Idempotency-Key', key);
  };

  beforeAll(async () => {
    app = await createTestApp({
      controllers: [IdempotentTestController],
      providers: [{ provide: IDEMPOTENCY_RECORD_REPOSITORY, useValue: records }],
    });
  });

  beforeEach(() => {
    executions = 0;
    records.records.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['is missing', undefined],
    ['is not a UUID', 'order-1'],
  ])(
    'answers 400 IDEMPOTENCY_KEY_REQUIRED without running the request when the key %s',
    async (_case, key) => {
      const response = await post(ORDERS_PATH, key);

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
      expect(executions).toBe(0);
    },
  );

  it('runs the first request and keeps its response', async () => {
    const response = await post(ORDERS_PATH, KEY);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ orderNumber: 1, quantity: 1 });
    expect(response.headers['idempotent-replayed']).toBeUndefined();
    expect(records.records.get(`POST ${ORDERS_PATH}#${KEY}`)).toMatchObject({
      status: 'COMPLETED',
      response: { statusCode: 201, body: '{"orderNumber":1,"quantity":1}' },
    });
  });

  it('replays the stored response to a repeat with the same body, even with keys reordered', async () => {
    await post(ORDERS_PATH, KEY, { quantity: 1, color: 'black' });

    const repeat = await post(ORDERS_PATH, KEY.toUpperCase(), { color: 'black', quantity: 1 });

    expect(repeat.status).toBe(201);
    expect(repeat.headers['idempotent-replayed']).toBe('true');
    expect(repeat.body).toEqual({ orderNumber: 1, quantity: 1, color: 'black' });
    expect(executions).toBe(1);
  });

  it('answers 409 IDEMPOTENCY_KEY_CONFLICT when the key is reused with another body', async () => {
    await post(ORDERS_PATH, KEY, { quantity: 1 });

    const reuse = await post(ORDERS_PATH, KEY, { quantity: 2 });

    expect(reuse.status).toBe(409);
    expect(reuse.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
    expect(executions).toBe(1);
  });

  it('treats the same key on another endpoint as a different request', async () => {
    await post(ORDERS_PATH, KEY);

    const other = await post(REJECTIONS_PATH, KEY);

    expect(other.status).toBe(409);
    expect(other.body).toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(executions).toBe(2);
  });

  it('asks to retry later while the original request is still running', async () => {
    const scope = `POST ${ORDERS_PATH}#${KEY}`;
    records.records.set(scope, {
      scope,
      requestHash: hashRequestBody({ quantity: 1 }),
      status: 'IN_PROGRESS',
      createdAt: new Date('2026-09-24T20:14:59.000Z'),
      expiresAt: new Date('2026-09-25T20:14:59.000Z'),
    });

    const concurrent = await post(ORDERS_PATH, KEY);

    expect(concurrent.status).toBe(409);
    expect(concurrent.headers['retry-after']).toBe('1');
    expect(concurrent.body).toMatchObject({ code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' });
    expect(executions).toBe(0);
  });

  it('keeps business errors and replays them as the same problem', async () => {
    const original = await post(REJECTIONS_PATH, KEY).set('X-Request-Id', 'trace-original');

    const repeat = await post(REJECTIONS_PATH, KEY).set('X-Request-Id', 'trace-repeat');

    expect(original.status).toBe(409);
    expect(repeat.status).toBe(409);
    expect(repeat.headers['idempotent-replayed']).toBe('true');
    expect(repeat.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(repeat.headers['cache-control']).toBe('no-store');
    expect(repeat.body).toEqual(original.body);
    expect(repeat.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', traceId: 'trace-original' });
    expect(executions).toBe(1);
  });

  it('releases the key after an unexpected error so the client can retry', async () => {
    const first = await post(FAILURES_PATH, KEY);

    const retry = await post(FAILURES_PATH, KEY);

    expect(first.status).toBe(500);
    expect(retry.status).toBe(500);
    expect(retry.headers['idempotent-replayed']).toBeUndefined();
    expect(executions).toBe(2);
    expect(records.records.size).toBe(0);
  });

  it('answers 500 without running the request when the key cannot be stored', async () => {
    jest.spyOn(records, 'create').mockReturnValueOnce(storageFailure());

    const response = await post(ORDERS_PATH, KEY);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(executions).toBe(0);
  });

  it('still returns the response when it cannot be stored', async () => {
    jest.spyOn(records, 'complete').mockReturnValueOnce(storageFailure());

    const response = await post(ORDERS_PATH, KEY);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ orderNumber: 1, quantity: 1 });
  });

  it('still returns the error when the key cannot be released', async () => {
    jest.spyOn(records, 'delete').mockReturnValueOnce(storageFailure());

    const response = await post(FAILURES_PATH, KEY);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('documents the required header and the idempotency errors in OpenAPI', () => {
    const operation = createOpenApiDocument(app, 'test').paths[ORDERS_PATH]?.post;

    expect(operation?.parameters).toContainEqual(
      expect.objectContaining({
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      }),
    );
    expect(Object.keys(operation?.responses ?? {})).toEqual(expect.arrayContaining(['400', '409']));
  });
});
