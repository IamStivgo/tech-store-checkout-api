import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types';

import { CUSTOMER_REPOSITORY } from '../../src/modules/customers/infrastructure/customer-repository.token';
import type { FieldError } from '../../src/shared/domain/validation-error';
import { IDEMPOTENCY_RECORD_REPOSITORY } from '../../src/shared/infrastructure/idempotency/idempotency-record-repository.token';
import { ID_GENERATOR } from '../../src/shared/infrastructure/system/id-generator.token';
import { aCustomer, aCustomerData, CUSTOMER_ID } from '../builders/customer.builder';
import { FakeIdGenerator } from '../fakes/fake-id-generator';
import { InMemoryCustomerRepository } from '../fakes/in-memory-customer.repository';
import { InMemoryIdempotencyRepository } from '../fakes/in-memory-idempotency.repository';

import { createTestApp } from './create-test-app';

const CUSTOMERS_PATH = '/api/v1/customers';
const KEY = '5b0c1a2e-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
const OTHER_KEY = '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b';
const SECOND_ID = '8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d';

const fieldErrorsOf = (response: Response): FieldError[] =>
  (response.body as { errors: FieldError[] }).errors;

const MASKED_ANA = {
  id: CUSTOMER_ID,
  fullName: 'Ana M. G.',
  email: 'a***@example.com',
  phone: '******4567',
  legalIdType: 'CC',
  legalId: '******4050',
  createdAt: '2026-09-24T20:15:00.000Z',
};

describe('Customers API', () => {
  let app: INestApplication<App>;
  let customers: InMemoryCustomerRepository;
  let records: InMemoryIdempotencyRepository;

  const create = (body: object, key: string = KEY) =>
    request(app.getHttpServer()).post(CUSTOMERS_PATH).set('Idempotency-Key', key).send(body);

  beforeEach(async () => {
    customers = new InMemoryCustomerRepository();
    records = new InMemoryIdempotencyRepository();
    app = await createTestApp({
      providers: [
        { provide: CUSTOMER_REPOSITORY, useValue: customers },
        { provide: IDEMPOTENCY_RECORD_REPOSITORY, useValue: records },
        { provide: ID_GENERATOR, useValue: new FakeIdGenerator([CUSTOMER_ID, SECOND_ID]) },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /customers', () => {
    it('creates the customer and answers 201 with its location and masked data', async () => {
      const response = await create(
        aCustomerData({ email: ' Ana.Gomez@Example.com', phone: '+57 300 123 4567' }),
      );

      expect(response.status).toBe(201);
      expect(response.headers.location).toBe(`${CUSTOMERS_PATH}/${CUSTOMER_ID}`);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(MASKED_ANA);
      expect(customers.customers.get(CUSTOMER_ID)?.email.value).toBe('ana.gomez@example.com');
    });

    it('replays a retried request without creating a second customer', async () => {
      await create(aCustomerData());

      const retry = await create(aCustomerData());

      expect(retry.status).toBe(201);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.headers.location).toBe(`${CUSTOMERS_PATH}/${CUSTOMER_ID}`);
      expect(retry.body).toEqual(MASKED_ANA);
      expect(customers.customers.size).toBe(1);
    });

    it('always creates a new customer for a new key, even with the same email', async () => {
      await create(aCustomerData());

      const second = await create(aCustomerData(), OTHER_KEY);

      expect(second.status).toBe(201);
      expect(second.body).toMatchObject({ id: SECOND_ID });
      expect(customers.customers.size).toBe(2);
    });

    it('requires an Idempotency-Key', async () => {
      const response = await request(app.getHttpServer())
        .post(CUSTOMERS_PATH)
        .send(aCustomerData());

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
      expect(customers.customers.size).toBe(0);
    });

    it('answers 400 with every invalid field', async () => {
      const response = await create({
        fullName: 'Ana',
        email: 'ana',
        phone: '123',
        legalIdType: 'TI',
        legalId: '1020304050',
      });

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(fieldErrorsOf(response).map(({ field }) => field)).toEqual([
        'fullName',
        'email',
        'phone',
        'legalIdType',
      ]);
    });

    it('rejects missing, mistyped and unknown fields', async () => {
      const response = await create({
        fullName: 'Ana María Gómez',
        email: 42,
        phone: '3001234567',
        legalIdType: 'CC',
        totalInCents: 1,
      });

      expect(response.status).toBe(400);
      expect(fieldErrorsOf(response)).toEqual(
        expect.arrayContaining([
          { field: 'email', message: 'email must be a string' },
          { field: 'legalId', message: 'legalId is required' },
          { field: 'totalInCents', message: 'totalInCents is not allowed' },
        ]),
      );
    });

    it('rejects a body that is not a JSON object', async () => {
      const response = await create([aCustomerData()]);

      expect(response.status).toBe(400);
      expect(fieldErrorsOf(response)).toEqual([
        { field: 'body', message: 'the request body must be a JSON object' },
      ]);
    });

    it('keeps the validation error for a retried invalid request', async () => {
      await create(aCustomerData({ email: 'ana' }));

      const retry = await create(aCustomerData({ email: 'ana' }));

      expect(retry.status).toBe(400);
      expect(retry.headers['idempotent-replayed']).toBe('true');
    });
  });

  describe('GET /customers/{customerId}', () => {
    it('returns the customer masked and never cached', async () => {
      customers.customers.set(CUSTOMER_ID, aCustomer());

      const response = await request(app.getHttpServer()).get(`${CUSTOMERS_PATH}/${CUSTOMER_ID}`);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(MASKED_ANA);
    });

    it('answers 404 CUSTOMER_NOT_FOUND for an unknown id', async () => {
      const response = await request(app.getHttpServer()).get(`${CUSTOMERS_PATH}/${SECOND_ID}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'CUSTOMER_NOT_FOUND' });
    });

    it('answers 400 for an id that is not a UUID v4', async () => {
      const response = await request(app.getHttpServer()).get(`${CUSTOMERS_PATH}/not-a-uuid`);

      expect(response.status).toBe(400);
      expect(fieldErrorsOf(response)).toEqual([
        { field: 'customerId', message: 'customerId must be a UUID v4' },
      ]);
    });
  });
});
