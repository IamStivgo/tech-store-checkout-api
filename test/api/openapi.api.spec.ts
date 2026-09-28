import { readFileSync } from 'node:fs';

import type { OpenAPIObject } from '@nestjs/swagger';

import { contractVersion, OPENAPI_FILE } from '../../scripts/openapi/contract';
import {
  createOpenApiDocument,
  serializeOpenApiDocument,
} from '../../src/shared/infrastructure/http/openapi/openapi-document';

import { createTestApp } from './create-test-app';

describe('OpenAPI contract', () => {
  let document: OpenAPIObject;

  beforeAll(async () => {
    const app = await createTestApp();
    document = createOpenApiDocument(app, contractVersion());
    await app.close();
  });

  it('documents every public endpoint under /api/v1', () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      '/api/v1/checkout/quote',
      '/api/v1/customers',
      '/api/v1/customers/{customerId}',
      '/api/v1/deliveries/{deliveryId}',
      '/api/v1/health',
      '/api/v1/locations/departments',
      '/api/v1/locations/departments/{departmentCode}/cities',
      '/api/v1/payments/acceptance-tokens',
      '/api/v1/payments/tokenization-key',
      '/api/v1/products',
      '/api/v1/products/{productId}',
      '/api/v1/products/{productId}/stock',
      '/api/v1/transactions',
      '/api/v1/transactions/{transactionId}',
      '/api/v1/transactions/{transactionId}/delivery',
      '/api/v1/transactions/{transactionId}/payment',
      '/api/v1/webhooks/payment-events',
    ]);
  });

  it('gives every operation a short, unique id for generated clients', () => {
    const operationIds = Object.values(document.paths).flatMap((path) =>
      Object.values(path).map((operation: { operationId?: string }) => operation.operationId),
    );

    expect(operationIds.sort()).toEqual([
      'checkoutQuote',
      'customersCreate',
      'customersDetail',
      'deliveriesDetail',
      'deliveriesOfTransaction',
      'healthCheck',
      'locationsCities',
      'locationsDepartments',
      'paymentEventsReceive',
      'paymentsAcceptanceTokens',
      'paymentsTokenizationKey',
      'productsDetail',
      'productsList',
      'productsStock',
      'transactionsCreate',
      'transactionsDetail',
      'transactionsPay',
      'transactionsUpdate',
    ]);
  });

  it('describes errors as Problem Details', () => {
    const notFound = document.paths['/api/v1/products/{productId}']?.get?.responses['404'];

    expect(notFound).toMatchObject({
      content: {
        'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
      },
    });
  });

  it('names the response schemas after the resources', () => {
    expect(Object.keys(document.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'Health',
        'ProductList',
        'ProductDetail',
        'ProductStock',
        'CityList',
      ]),
    );
    expect(document.components?.schemas?.ProductDetail).toMatchObject({
      required: expect.arrayContaining(['id', 'price', 'stock', 'maxUnitsPerOrder']) as unknown,
    });
  });

  it('matches the committed docs/openapi.json (run `npm run openapi:export` after API changes)', () => {
    expect(readFileSync(OPENAPI_FILE, 'utf8')).toBe(serializeOpenApiDocument(document));
  });
});
