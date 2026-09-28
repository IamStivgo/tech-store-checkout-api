import { loadAppConfig, loadDynamoDbConnection } from './app-config';
import { InvalidConfigError } from './invalid-config.error';

const REQUIRED = {
  APP_ENV: 'local',
  TABLE_PRODUCTS: 'checkout-app-local-products',
  TABLE_CUSTOMERS: 'checkout-app-local-customers',
  TABLE_TRANSACTIONS: 'checkout-app-local-transactions',
  TABLE_DELIVERIES: 'checkout-app-local-deliveries',
  TABLE_TRANSACTION_EVENTS: 'checkout-app-local-transaction-events',
  TABLE_IDEMPOTENCY: 'checkout-app-local-idempotency-keys',
};

describe('loadAppConfig', () => {
  it('applies defaults when only the required variables are set', () => {
    const config = loadAppConfig(REQUIRED);

    expect(config).toEqual({
      appEnv: 'local',
      appVersion: '0.0.0-local',
      logLevel: 'info',
      port: 3000,
      corsAllowedOrigins: [],
      originVerifySecret: undefined,
      awsRegion: 'us-east-1',
      dynamodbEndpoint: undefined,
      tables: {
        products: 'checkout-app-local-products',
        customers: 'checkout-app-local-customers',
        transactions: 'checkout-app-local-transactions',
        deliveries: 'checkout-app-local-deliveries',
        transactionEvents: 'checkout-app-local-transaction-events',
        idempotency: 'checkout-app-local-idempotency-keys',
      },
      catalog: { lowStockThreshold: 3, maxUnitsPerOrder: 5 },
      pricing: { serviceFeeInCents: 300_000, freeShippingThresholdInCents: 15_000_000 },
      transactions: { reservationTtlMinutes: 15, referencePrefix: 'CKT' },
      payments: { provider: 'fake' },
    });
  });

  it('parses every provided variable', () => {
    const config = loadAppConfig({
      APP_ENV: 'prod',
      APP_VERSION: '1.0.0+abc123',
      LOG_LEVEL: 'warn',
      PORT: '8080',
      CORS_ALLOWED_ORIGINS: ' http://localhost:5173 , ,http://localhost:8080',
      AWS_REGION: 'us-east-2',
      DYNAMODB_ENDPOINT: 'http://localhost:8000',
      TABLE_PRODUCTS: 'checkout-app-prod-products',
      TABLE_CUSTOMERS: 'checkout-app-prod-customers',
      TABLE_TRANSACTIONS: 'checkout-app-prod-transactions',
      TABLE_DELIVERIES: 'checkout-app-prod-deliveries',
      TABLE_TRANSACTION_EVENTS: 'checkout-app-prod-transaction-events',
      STOCK_RESERVATION_TTL_MINUTES: '10',
      REFERENCE_PREFIX: 'TST',
      TABLE_IDEMPOTENCY: 'checkout-app-prod-idempotency-keys',
      LOW_STOCK_THRESHOLD: '2',
      MAX_UNITS_PER_ORDER: '10',
      SERVICE_FEE_IN_CENTS: '250000',
      FREE_SHIPPING_THRESHOLD_IN_CENTS: '20000000',
      PAYMENT_PROVIDER: 'http',
      PAYMENT_API_BASE_URL: 'https://provider.test/v1',
      PAYMENT_PUBLIC_KEY: 'pub_test_key',
      PAYMENT_PRIVATE_KEY_PARAM: '/checkout-app/prod/payment/private-key',
      PAYMENT_INTEGRITY_SECRET_PARAM: '/checkout-app/prod/payment/integrity-secret',
      PAYMENT_EVENTS_SECRET_PARAM: '/checkout-app/prod/payment/events-secret',
      PAYMENT_EVENTS_ENVIRONMENT: 'prod',
      PAYMENT_HTTP_TIMEOUT_MS: '4000',
    });

    expect(config).toEqual({
      appEnv: 'prod',
      appVersion: '1.0.0+abc123',
      logLevel: 'warn',
      port: 8080,
      corsAllowedOrigins: ['http://localhost:5173', 'http://localhost:8080'],
      originVerifySecret: undefined,
      awsRegion: 'us-east-2',
      dynamodbEndpoint: 'http://localhost:8000',
      tables: {
        products: 'checkout-app-prod-products',
        customers: 'checkout-app-prod-customers',
        transactions: 'checkout-app-prod-transactions',
        deliveries: 'checkout-app-prod-deliveries',
        transactionEvents: 'checkout-app-prod-transaction-events',
        idempotency: 'checkout-app-prod-idempotency-keys',
      },
      catalog: { lowStockThreshold: 2, maxUnitsPerOrder: 10 },
      pricing: { serviceFeeInCents: 250_000, freeShippingThresholdInCents: 20_000_000 },
      transactions: { reservationTtlMinutes: 10, referencePrefix: 'TST' },
      payments: {
        provider: 'http',
        apiBaseUrl: 'https://provider.test/v1',
        publicKey: 'pub_test_key',
        privateKey: { parameterName: '/checkout-app/prod/payment/private-key' },
        integritySecret: { parameterName: '/checkout-app/prod/payment/integrity-secret' },
        eventsSecret: { parameterName: '/checkout-app/prod/payment/events-secret' },
        eventsEnvironment: 'prod',
        timeoutMs: 4000,
      },
    });
  });

  it('takes local secret values when there are no SSM parameters', () => {
    const config = loadAppConfig({
      ...REQUIRED,
      PAYMENT_PROVIDER: 'http',
      PAYMENT_API_BASE_URL: 'https://provider.test/v1',
      PAYMENT_PUBLIC_KEY: 'pub_test_key',
      PAYMENT_PRIVATE_KEY: 'prv_test_key',
      PAYMENT_INTEGRITY_SECRET: 'integrity_secret_for_tests',
      PAYMENT_EVENTS_SECRET: 'events_secret_for_tests',
    });

    expect(config.payments).toMatchObject({
      privateKey: { value: 'prv_test_key' },
      integritySecret: { value: 'integrity_secret_for_tests' },
      eventsSecret: { value: 'events_secret_for_tests' },
      // The sandbox sends its events as `test`.
      eventsEnvironment: 'test',
      timeoutMs: 5000,
    });
  });

  it('never runs the fake payment provider in prod', () => {
    expect(() => loadAppConfig({ ...REQUIRED, APP_ENV: 'prod' })).toThrow(
      /PAYMENT_PROVIDER: the fake payment provider is not allowed in prod/,
    );
  });

  it('lists everything the HTTP payment provider is missing', () => {
    const error = captureConfigError({ ...REQUIRED, PAYMENT_PROVIDER: 'http' });

    expect(error.issues).toEqual([
      'PAYMENT_API_BASE_URL: required by the http payment provider',
      'PAYMENT_PUBLIC_KEY: required by the http payment provider',
      'PAYMENT_PRIVATE_KEY_PARAM: set it or PAYMENT_PRIVATE_KEY',
      'PAYMENT_INTEGRITY_SECRET_PARAM: set it or PAYMENT_INTEGRITY_SECRET',
      'PAYMENT_EVENTS_SECRET_PARAM: set it or PAYMENT_EVENTS_SECRET',
    ]);
  });

  it.each([
    'APP_ENV',
    'TABLE_PRODUCTS',
    'TABLE_CUSTOMERS',
    'TABLE_TRANSACTIONS',
    'TABLE_IDEMPOTENCY',
  ])('fails fast when %s is missing', (variable) => {
    const env = Object.fromEntries(Object.entries(REQUIRED).filter(([key]) => key !== variable));

    expect(() => loadAppConfig(env)).toThrow(InvalidConfigError);
    expect(() => loadAppConfig(env)).toThrow(new RegExp(variable));
  });

  it.each([
    ['APP_ENV', { APP_ENV: 'staging' }],
    ['LOG_LEVEL', { LOG_LEVEL: 'verbose' }],
    ['PORT', { PORT: 'not-a-number' }],
    ['PORT', { PORT: '70000' }],
    ['APP_VERSION', { APP_VERSION: '   ' }],
    ['DYNAMODB_ENDPOINT', { DYNAMODB_ENDPOINT: 'localhost-8000' }],
    ['LOW_STOCK_THRESHOLD', { LOW_STOCK_THRESHOLD: '-1' }],
    ['MAX_UNITS_PER_ORDER', { MAX_UNITS_PER_ORDER: '0' }],
    ['STOCK_RESERVATION_TTL_MINUTES', { STOCK_RESERVATION_TTL_MINUTES: '0' }],
    ['REFERENCE_PREFIX', { REFERENCE_PREFIX: 'ckt-1' }],
  ])('rejects an invalid %s', (variable, overrides) => {
    expect(() => loadAppConfig({ ...REQUIRED, ...overrides })).toThrow(new RegExp(variable));
  });

  it('reports every invalid variable at once', () => {
    const error = captureConfigError({ LOG_LEVEL: 'verbose', PORT: '0' });

    expect(error.issues.map((issue) => issue.split(':')[0]).sort()).toEqual([
      'APP_ENV',
      'LOG_LEVEL',
      'PORT',
      'TABLE_CUSTOMERS',
      'TABLE_DELIVERIES',
      'TABLE_IDEMPOTENCY',
      'TABLE_PRODUCTS',
      'TABLE_TRANSACTIONS',
      'TABLE_TRANSACTION_EVENTS',
    ]);
  });

  it('does not echo invalid values in the error message', () => {
    const error = captureConfigError({ ...REQUIRED, APP_ENV: 'super-secret-value' });

    expect(error.message).not.toContain('super-secret-value');
  });
});

function captureConfigError(env: Record<string, string>): InvalidConfigError {
  try {
    loadAppConfig(env);
  } catch (error) {
    if (error instanceof InvalidConfigError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected loadAppConfig to throw');
}

describe('loadDynamoDbConnection', () => {
  it('needs no table names, so single-table scripts like the seed can use it', () => {
    expect(loadDynamoDbConnection({})).toEqual({
      awsRegion: 'us-east-1',
      dynamodbEndpoint: undefined,
    });
  });

  it('points at DynamoDB Local when an endpoint is set', () => {
    expect(
      loadDynamoDbConnection({
        AWS_REGION: 'us-east-2',
        DYNAMODB_ENDPOINT: 'http://localhost:8000',
      }),
    ).toEqual({ awsRegion: 'us-east-2', dynamodbEndpoint: 'http://localhost:8000' });
  });

  it('rejects an invalid endpoint', () => {
    expect(() => loadDynamoDbConnection({ DYNAMODB_ENDPOINT: 'not-a-url' })).toThrow(
      /DYNAMODB_ENDPOINT/,
    );
  });
});
