import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { ORIGIN_VERIFY_HEADER } from '../../src/shared/infrastructure/http/request-guards';

import { createTestApp } from './create-test-app';

const SECRET = 'a-shared-secret-of-at-least-32-characters';

describe('Origin verification (CloudFront secret header)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ env: { ORIGIN_VERIFY_SECRET: SECRET } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers requests that come through CloudFront', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set(ORIGIN_VERIFY_HEADER, SECRET);

    expect(response.status).toBe(200);
  });

  it.each([
    ['without the header', undefined],
    ['with another value', 'a-different-secret-of-at-least-32-characters'],
  ])('refuses a direct request %s with Problem Details', async (_case, value) => {
    const call = request(app.getHttpServer()).get('/api/v1/health');
    const response = await (value ? call.set(ORIGIN_VERIFY_HEADER, value) : call);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(response.headers['x-request-id']).toBeDefined();
  });
});

describe('Origin verification without a secret (local)', () => {
  it('answers every request', async () => {
    const app = await createTestApp();

    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    await app.close();
  });
});
