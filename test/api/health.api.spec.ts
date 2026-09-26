import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { FakeClock } from '../fakes/fake-clock';

import { createTestApp } from './create-test-app';

describe('GET /api/v1/health', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({
      env: { APP_VERSION: '1.2.3+abc123' },
      clock: new FakeClock(new Date('2026-09-24T20:15:00.000Z')),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the service status, version and current time', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      version: '1.2.3+abc123',
      time: '2026-09-24T20:15:00.000Z',
    });
  });

  it('is never cached', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns a generated X-Request-Id when the client sends none', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('echoes a safe X-Request-Id sent by the client', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'smoke-test-42');

    expect(response.headers['x-request-id']).toBe('smoke-test-42');
  });

  it('is only exposed under the versioned api prefix', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(404);
  });
});
