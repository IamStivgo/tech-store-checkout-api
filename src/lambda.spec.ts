import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';

import { createApiHandler } from './lambda';

const gatewayEvent = (
  path: string,
  headers: Record<string, string> = {},
): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: 'ANY /api/{proxy+}',
  rawPath: path,
  rawQueryString: '',
  headers: { host: 'api.example.com', ...headers },
  requestContext: {
    accountId: '123456789012',
    apiId: 'api-id',
    domainName: 'api.example.com',
    domainPrefix: 'api',
    http: {
      method: 'GET',
      path,
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'jest',
    },
    requestId: 'gateway-request-1',
    routeKey: 'ANY /api/{proxy+}',
    stage: '$default',
    time: '24/Sep/2026:20:15:00 +0000',
    timeEpoch: 1_790_000_000_000,
  },
  isBase64Encoded: false,
});

const lambdaContext = {} as Context;

describe('API Gateway Lambda handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, APP_ENV: 'test', APP_VERSION: '9.9.9', LOG_LEVEL: 'silent' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('serves the Nest app through API Gateway events', async () => {
    const handler = createApiHandler();

    const response = await handler(gatewayEvent('/api/v1/health'), lambdaContext);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? '{}')).toMatchObject({ status: 'ok', version: '9.9.9' });
  });

  it('uses the API Gateway request id as X-Request-Id', async () => {
    const handler = createApiHandler();

    const response = await handler(
      gatewayEvent('/api/v1/health', { 'x-request-id': 'client-value' }),
      lambdaContext,
    );

    expect(response.headers?.['x-request-id']).toBe('gateway-request-1');
  });

  it('answers errors with Problem Details', async () => {
    const handler = createApiHandler();

    const response = await handler(gatewayEvent('/api/v1/unknown'), lambdaContext);

    expect(response.statusCode).toBe(404);
    expect(response.headers?.['content-type']).toMatch(/^application\/problem\+json/);
  });

  it('retries the bootstrap after a failed cold start', async () => {
    const handler = createApiHandler();
    delete process.env.APP_ENV;

    await expect(handler(gatewayEvent('/api/v1/health'), lambdaContext)).rejects.toThrow(/APP_ENV/);

    process.env.APP_ENV = 'test';
    const response = await handler(gatewayEvent('/api/v1/health'), lambdaContext);

    expect(response.statusCode).toBe(200);
  });
});
