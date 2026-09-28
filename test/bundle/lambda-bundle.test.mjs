// Smoke test of the deployable Lambda bundle (dist-lambda/), run after `npm run build:lambda`.
// It loads the same files Lambda loads, so it catches what unit tests cannot: modules webpack
// failed to include, lazy requires, bundled JSON data and the handler export contract.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { before, describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const BUNDLE_DIR = path.resolve(import.meta.dirname, '../../dist-lambda');

Object.assign(process.env, {
  APP_ENV: 'test',
  APP_VERSION: '9.9.9-bundle',
  LOG_LEVEL: 'silent',
  TABLE_PRODUCTS: 'checkout-app-test-products',
  TABLE_CUSTOMERS: 'checkout-app-test-customers',
  TABLE_TRANSACTIONS: 'checkout-app-test-transactions',
  TABLE_IDEMPOTENCY: 'checkout-app-test-idempotency-keys',
});

const gatewayEvent = (method, rawPath) => ({
  version: '2.0',
  routeKey: 'ANY /api/{proxy+}',
  rawPath,
  rawQueryString: '',
  headers: { host: 'api.example.com' },
  requestContext: {
    accountId: '123456789012',
    apiId: 'api-id',
    domainName: 'api.example.com',
    domainPrefix: 'api',
    http: {
      method,
      path: rawPath,
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'node-test',
    },
    requestId: 'bundle-request-1',
    routeKey: 'ANY /api/{proxy+}',
    stage: '$default',
    time: '27/Sep/2026:15:00:00 +0000',
    timeEpoch: 1_790_000_000_000,
  },
  isBase64Encoded: false,
});

describe('Lambda bundle', () => {
  let api;
  let reconcile;

  before(() => {
    for (const file of ['lambda.js', 'reconcile.js']) {
      assert.ok(existsSync(path.join(BUNDLE_DIR, file)), `${file} must be at the bundle root`);
    }
    api = require(path.join(BUNDLE_DIR, 'lambda.js'));
    reconcile = require(path.join(BUNDLE_DIR, 'reconcile.js'));
  });

  it('exports the handlers the infrastructure configures', () => {
    assert.equal(typeof api.handler, 'function');
    assert.equal(typeof reconcile.handler, 'function');
  });

  it('answers the health check through the API Gateway adapter', async () => {
    const response = await api.handler(gatewayEvent('GET', '/api/v1/health'), {});

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-request-id'], 'bundle-request-1');
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'ok');
    assert.equal(body.version, '9.9.9-bundle');
  });

  it('serves the bundled coverage dataset', async () => {
    const response = await api.handler(gatewayEvent('GET', '/api/v1/locations/departments'), {});

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.meta.count, 33);
    assert.ok(body.data.some((department) => department.name === 'Antioquia'));
  });

  it('keeps Problem Details for unknown routes', async () => {
    const response = await api.handler(gatewayEvent('GET', '/api/v1/unknown'), {});

    assert.equal(response.statusCode, 404);
    assert.match(response.headers['content-type'], /^application\/problem\+json/);
  });

  it('carries the package version when the function defines no APP_VERSION', () => {
    const env = { ...process.env };
    delete env.APP_VERSION;
    const reported = execFileSync(
      process.execPath,
      [
        '-p',
        `require(${JSON.stringify(path.join(BUNDLE_DIR, 'lambda.js'))}), process.env.APP_VERSION`,
      ],
      { env, encoding: 'utf8' },
    ).trim();
    const { version } = JSON.parse(
      readFileSync(path.resolve(BUNDLE_DIR, '../package.json'), 'utf8'),
    );

    assert.match(reported, new RegExp(`^${version.replaceAll('.', '\\.')}(\\+[0-9a-f]+)?$`));
  });

  it('runs the reconciliation handler', async () => {
    assert.deepEqual(await reconcile.handler(), { expired: 0, synced: 0, failed: 0 });
  });
});
