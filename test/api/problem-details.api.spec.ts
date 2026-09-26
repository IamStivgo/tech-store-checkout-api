import { Controller, Get, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { createTestApp } from './create-test-app';

@Controller('test-failures')
class FailingController {
  @Get('unexpected')
  failUnexpectedly(): never {
    throw new Error('connection string with db-password=hunter2');
  }
}

describe('Problem Details error responses', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [FailingController] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers unknown routes with a 404 problem', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist?email=ana@example.com')
      .set('X-Request-Id', 'trace-404');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual({
      type: '/problems/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'The requested resource does not exist.',
      instance: '/api/v1/does-not-exist',
      code: 'NOT_FOUND',
      traceId: 'trace-404',
    });
  });

  it('hides internal details of unexpected errors behind a 500 problem', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/test-failures/unexpected');
    const requestId = response.headers['x-request-id'];

    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
      traceId: requestId,
    });
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
  });
});
