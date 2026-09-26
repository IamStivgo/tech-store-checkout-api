import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { createTestApp } from './create-test-app';

describe('Locations API', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/locations/departments', () => {
    it('lists the 33 departments sorted by name and lets clients cache them for a day', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/locations/departments');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=86400');
      expect(response.body).toMatchObject({
        data: expect.arrayContaining([{ code: '05', name: 'Antioquia' }]) as unknown,
        meta: { count: 33 },
      });
    });
  });

  describe('GET /api/v1/locations/departments/{departmentCode}/cities', () => {
    it('lists the cities of the department with their delivery zone', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/locations/departments/05/cities',
      );

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=86400');
      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          { code: '05001', name: 'Medellín', zone: 'NATIONAL_MAIN' },
        ]) as unknown,
        meta: { count: 125 },
      });
    });

    it('answers 404 DEPARTMENT_NOT_FOUND for unknown departments, without caching', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/locations/departments/00/cities',
      );

      expect(response.status).toBe(404);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' });
    });

    it.each(['5', '055', 'AB'])(
      'answers 400 VALIDATION_ERROR for the invalid code %s',
      async (departmentCode) => {
        const response = await request(app.getHttpServer()).get(
          `/api/v1/locations/departments/${departmentCode}/cities`,
        );

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          code: 'VALIDATION_ERROR',
          errors: [
            { field: 'departmentCode', message: 'departmentCode must have exactly 2 digits' },
          ],
        });
      },
    );
  });
});
