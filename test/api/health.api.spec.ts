import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../../src/app.module';
import { loadAppConfig } from '../../src/config/app-config';
import { APP_CONFIG } from '../../src/config/app-config.token';
import { configureApp } from '../../src/shared/infrastructure/http/configure-app';
import { CLOCK } from '../../src/shared/infrastructure/system/clock.token';
import { FakeClock } from '../fakes/fake-clock';

describe('GET /api/v1/health', () => {
  const config = loadAppConfig({
    APP_ENV: 'test',
    APP_VERSION: '1.2.3+abc123',
    LOG_LEVEL: 'silent',
  });
  const clock = new FakeClock(new Date('2026-09-24T20:15:00.000Z'));
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, config);
    await app.init();
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
