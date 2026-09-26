import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { PRODUCT_REPOSITORY } from '../../src/modules/products/infrastructure/product-repository.token';
import { PersistenceError } from '../../src/shared/domain/persistence-error';
import { aProduct, aStock } from '../builders/product.builder';
import { InMemoryProductRepository } from '../fakes/in-memory-product.repository';

import { createTestApp } from './create-test-app';

const CABLE_ID = '7b1c6f0e-3a2d-4f7e-9c1a-2d4b5e6f7a8b';
const HIDDEN_ID = '3f2c1d0e-9b8a-4c7d-8e6f-5a4b3c2d1e0f';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

const cable = aProduct({ id: CABLE_ID, stock: aStock({ available: 2 }) });
const hidden = aProduct({ id: HIDDEN_ID, sku: 'TEC-HIDDEN', active: false });

describe('Products API', () => {
  let app: INestApplication<App>;

  const startApp = async (repository: InMemoryProductRepository): Promise<void> => {
    app = await createTestApp({
      providers: [{ provide: PRODUCT_REPOSITORY, useValue: repository }],
    });
  };

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/products', () => {
    it('lists active products with the contract shape', async () => {
      await startApp(new InMemoryProductRepository([cable, hidden]));

      const response = await request(app.getHttpServer()).get('/api/v1/products');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.body).toEqual({
        data: [
          {
            id: CABLE_ID,
            sku: 'TEC-CBL-USBC',
            name: 'Cable USB-C a USB-C 2 m (100 W)',
            shortDescription: 'Carga rápida de hasta 100 W y transferencia de datos USB 2.0.',
            price: { amountInCents: 3_990_000, currency: 'COP' },
            stock: { available: 2, status: 'LOW_STOCK' },
            image: expect.objectContaining({
              src: '/images/products/tec-cbl-usbc-640.jpg',
            }) as unknown,
          },
        ],
        meta: { count: 1 },
      });
    });

    it('hides persistence failures behind a 500 problem', async () => {
      await startApp(
        new InMemoryProductRepository().failWith(
          new PersistenceError('products.findAllActive', new Error('table not found')),
        ),
      );

      const response = await request(app.getHttpServer()).get('/api/v1/products');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({ code: 'INTERNAL_ERROR' });
      expect(JSON.stringify(response.body)).not.toContain('table not found');
    });
  });

  describe('GET /api/v1/products/{productId}', () => {
    it('returns the product detail', async () => {
      await startApp(new InMemoryProductRepository([cable]));

      const response = await request(app.getHttpServer()).get(`/api/v1/products/${CABLE_ID}`);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.body).toMatchObject({
        id: CABLE_ID,
        description: cable.description,
        weightGrams: 60,
        maxUnitsPerOrder: 2,
        images: [expect.objectContaining({ alt: cable.mainImage.alt })],
      });
    });

    it.each([
      ['does not exist', UNKNOWN_ID],
      ['is inactive', HIDDEN_ID],
    ])('answers 404 PRODUCT_NOT_FOUND when the product %s', async (_case, productId) => {
      await startApp(new InMemoryProductRepository([cable, hidden]));

      const response = await request(app.getHttpServer()).get(`/api/v1/products/${productId}`);

      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.body).toMatchObject({
        code: 'PRODUCT_NOT_FOUND',
        detail: 'The product does not exist or is no longer available.',
      });
    });

    it('answers 400 VALIDATION_ERROR for an invalid id', async () => {
      await startApp(new InMemoryProductRepository([cable]));

      const response = await request(app.getHttpServer()).get('/api/v1/products/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'productId', message: 'productId must be a UUID v4' }],
      });
    });
  });

  describe('GET /api/v1/products/{productId}/stock', () => {
    it('returns the lightweight stock and is never cached', async () => {
      await startApp(new InMemoryProductRepository([cable]));

      const response = await request(app.getHttpServer()).get(`/api/v1/products/${CABLE_ID}/stock`);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual({
        productId: CABLE_ID,
        available: 2,
        status: 'LOW_STOCK',
        updatedAt: '2026-09-24T20:15:00.000Z',
      });
    });

    it('answers 404 PRODUCT_NOT_FOUND for unknown products', async () => {
      await startApp(new InMemoryProductRepository());

      const response = await request(app.getHttpServer()).get(
        `/api/v1/products/${UNKNOWN_ID}/stock`,
      );

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    });
  });
});
