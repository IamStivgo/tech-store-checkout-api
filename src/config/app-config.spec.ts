import { loadAppConfig, loadDynamoDbConnection } from './app-config';
import { InvalidConfigError } from './invalid-config.error';

const REQUIRED = {
  APP_ENV: 'local',
  TABLE_PRODUCTS: 'checkout-app-local-products',
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
      awsRegion: 'us-east-1',
      dynamodbEndpoint: undefined,
      tables: {
        products: 'checkout-app-local-products',
        idempotency: 'checkout-app-local-idempotency-keys',
      },
      catalog: { lowStockThreshold: 3, maxUnitsPerOrder: 5 },
      pricing: { serviceFeeInCents: 300_000, freeShippingThresholdInCents: 15_000_000 },
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
      TABLE_IDEMPOTENCY: 'checkout-app-prod-idempotency-keys',
      LOW_STOCK_THRESHOLD: '2',
      MAX_UNITS_PER_ORDER: '10',
      SERVICE_FEE_IN_CENTS: '250000',
      FREE_SHIPPING_THRESHOLD_IN_CENTS: '20000000',
    });

    expect(config).toEqual({
      appEnv: 'prod',
      appVersion: '1.0.0+abc123',
      logLevel: 'warn',
      port: 8080,
      corsAllowedOrigins: ['http://localhost:5173', 'http://localhost:8080'],
      awsRegion: 'us-east-2',
      dynamodbEndpoint: 'http://localhost:8000',
      tables: {
        products: 'checkout-app-prod-products',
        idempotency: 'checkout-app-prod-idempotency-keys',
      },
      catalog: { lowStockThreshold: 2, maxUnitsPerOrder: 10 },
      pricing: { serviceFeeInCents: 250_000, freeShippingThresholdInCents: 20_000_000 },
    });
  });

  it.each(['APP_ENV', 'TABLE_PRODUCTS', 'TABLE_IDEMPOTENCY'])(
    'fails fast when %s is missing',
    (variable) => {
      const env = Object.fromEntries(Object.entries(REQUIRED).filter(([key]) => key !== variable));

      expect(() => loadAppConfig(env)).toThrow(InvalidConfigError);
      expect(() => loadAppConfig(env)).toThrow(new RegExp(variable));
    },
  );

  it.each([
    ['APP_ENV', { APP_ENV: 'staging' }],
    ['LOG_LEVEL', { LOG_LEVEL: 'verbose' }],
    ['PORT', { PORT: 'not-a-number' }],
    ['PORT', { PORT: '70000' }],
    ['APP_VERSION', { APP_VERSION: '   ' }],
    ['DYNAMODB_ENDPOINT', { DYNAMODB_ENDPOINT: 'localhost-8000' }],
    ['LOW_STOCK_THRESHOLD', { LOW_STOCK_THRESHOLD: '-1' }],
    ['MAX_UNITS_PER_ORDER', { MAX_UNITS_PER_ORDER: '0' }],
  ])('rejects an invalid %s', (variable, overrides) => {
    expect(() => loadAppConfig({ ...REQUIRED, ...overrides })).toThrow(new RegExp(variable));
  });

  it('reports every invalid variable at once', () => {
    const error = captureConfigError({ LOG_LEVEL: 'verbose', PORT: '0' });

    expect(error.issues.map((issue) => issue.split(':')[0]).sort()).toEqual([
      'APP_ENV',
      'LOG_LEVEL',
      'PORT',
      'TABLE_IDEMPOTENCY',
      'TABLE_PRODUCTS',
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
