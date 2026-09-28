import { z } from 'zod';

import { InvalidConfigError } from './invalid-config.error';

const APP_ENVS = ['local', 'test', 'prod'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const DEFAULT_PORT = 3000;
const MAX_PORT = 65_535;
const DEFAULT_AWS_REGION = 'us-east-1';
const DEFAULT_LOW_STOCK_THRESHOLD = 3;
const DEFAULT_MAX_UNITS_PER_ORDER = 5;
// Business rules §7: COP 3.000 service fee and free shipping from COP 150.000, in cents.
const DEFAULT_SERVICE_FEE_IN_CENTS = 300_000;
const DEFAULT_FREE_SHIPPING_THRESHOLD_IN_CENTS = 15_000_000;
const PAYMENT_PROVIDERS = ['http', 'fake'] as const;
const DEFAULT_RESERVATION_TTL_MINUTES = 15;
const DEFAULT_REFERENCE_PREFIX = 'CKT';
const DEFAULT_PAYMENT_TIMEOUT_MS = 5000;

// Connection settings shared by the app and the scripts that only touch one table (seed).
const dynamoDbConnectionSchema = z.object({
  AWS_REGION: z.string().trim().min(1).default(DEFAULT_AWS_REGION),
  DYNAMODB_ENDPOINT: z.url().optional(),
});

const appConfigSchema = dynamoDbConnectionSchema
  .extend({
    APP_ENV: z.enum(APP_ENVS),
    APP_VERSION: z.string().trim().min(1).default('0.0.0-local'),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default('')
      .transform((origins) =>
        origins
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      ),
    TABLE_PRODUCTS: z.string().trim().min(1),
    TABLE_CUSTOMERS: z.string().trim().min(1),
    TABLE_TRANSACTIONS: z.string().trim().min(1),
    TABLE_DELIVERIES: z.string().trim().min(1),
    TABLE_IDEMPOTENCY: z.string().trim().min(1),
    LOW_STOCK_THRESHOLD: z.coerce.number().int().min(0).default(DEFAULT_LOW_STOCK_THRESHOLD),
    MAX_UNITS_PER_ORDER: z.coerce.number().int().min(1).default(DEFAULT_MAX_UNITS_PER_ORDER),
    SERVICE_FEE_IN_CENTS: z.coerce.number().int().min(0).default(DEFAULT_SERVICE_FEE_IN_CENTS),
    FREE_SHIPPING_THRESHOLD_IN_CENTS: z.coerce
      .number()
      .int()
      .min(0)
      .default(DEFAULT_FREE_SHIPPING_THRESHOLD_IN_CENTS),
    STOCK_RESERVATION_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .default(DEFAULT_RESERVATION_TTL_MINUTES),
    REFERENCE_PREFIX: z
      .string()
      .regex(/^[A-Z]{2,5}$/)
      .default(DEFAULT_REFERENCE_PREFIX),
    // `fake` decides the payment result from the card token (local, tests and Docker only).
    PAYMENT_PROVIDER: z.enum(PAYMENT_PROVIDERS).default('fake'),
    PAYMENT_API_BASE_URL: z.url().optional(),
    PAYMENT_PUBLIC_KEY: z.string().trim().min(1).optional(),
    // Each secret comes from an SSM SecureString (…_PARAM, in AWS) or, locally, from its value.
    PAYMENT_PRIVATE_KEY_PARAM: z.string().trim().min(1).optional(),
    PAYMENT_PRIVATE_KEY: z.string().trim().min(1).optional(),
    PAYMENT_INTEGRITY_SECRET_PARAM: z.string().trim().min(1).optional(),
    PAYMENT_INTEGRITY_SECRET: z.string().trim().min(1).optional(),
    PAYMENT_EVENTS_SECRET_PARAM: z.string().trim().min(1).optional(),
    PAYMENT_EVENTS_SECRET: z.string().trim().min(1).optional(),
    // Events of the other environment (sandbox `test` or real `prod`) are ignored.
    PAYMENT_EVENTS_ENVIRONMENT: z.enum(['test', 'prod']).default('test'),
    PAYMENT_HTTP_TIMEOUT_MS: z.coerce.number().int().min(1).default(DEFAULT_PAYMENT_TIMEOUT_MS),
  })
  .superRefine((env, context) => {
    const addIssue = (variable: keyof typeof env, message: string) => {
      context.addIssue({ code: 'custom', path: [variable], message });
    };
    if (env.APP_ENV === 'prod' && env.PAYMENT_PROVIDER === 'fake') {
      addIssue('PAYMENT_PROVIDER', 'the fake payment provider is not allowed in prod');
    }
    if (env.PAYMENT_PROVIDER !== 'http') {
      return;
    }
    if (!env.PAYMENT_API_BASE_URL) {
      addIssue('PAYMENT_API_BASE_URL', 'required by the http payment provider');
    }
    if (!env.PAYMENT_PUBLIC_KEY) {
      addIssue('PAYMENT_PUBLIC_KEY', 'required by the http payment provider');
    }
    if (!env.PAYMENT_PRIVATE_KEY_PARAM && !env.PAYMENT_PRIVATE_KEY) {
      addIssue('PAYMENT_PRIVATE_KEY_PARAM', 'set it or PAYMENT_PRIVATE_KEY');
    }
    if (!env.PAYMENT_INTEGRITY_SECRET_PARAM && !env.PAYMENT_INTEGRITY_SECRET) {
      addIssue('PAYMENT_INTEGRITY_SECRET_PARAM', 'set it or PAYMENT_INTEGRITY_SECRET');
    }
    if (!env.PAYMENT_EVENTS_SECRET_PARAM && !env.PAYMENT_EVENTS_SECRET) {
      addIssue('PAYMENT_EVENTS_SECRET_PARAM', 'set it or PAYMENT_EVENTS_SECRET');
    }
  });

export type AppEnv = (typeof APP_ENVS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface DynamoDbConnection {
  readonly awsRegion: string;
  /** Only set locally, to point the SDK at DynamoDB Local. */
  readonly dynamodbEndpoint: string | undefined;
}

/** Where a secret comes from: an SSM SecureString parameter (AWS) or its value (local). */
export type SecretSource = { readonly parameterName: string } | { readonly value: string };

export type PaymentsConfig =
  | { readonly provider: 'fake' }
  | {
      readonly provider: 'http';
      readonly apiBaseUrl: string;
      readonly publicKey: string;
      readonly privateKey: SecretSource;
      readonly integritySecret: SecretSource;
      readonly eventsSecret: SecretSource;
      readonly eventsEnvironment: 'test' | 'prod';
      readonly timeoutMs: number;
    };

export interface AppConfig extends DynamoDbConnection {
  readonly appEnv: AppEnv;
  readonly appVersion: string;
  readonly logLevel: LogLevel;
  readonly port: number;
  readonly corsAllowedOrigins: readonly string[];
  readonly tables: {
    readonly products: string;
    readonly customers: string;
    readonly transactions: string;
    readonly deliveries: string;
    readonly idempotency: string;
  };
  readonly catalog: {
    readonly lowStockThreshold: number;
    readonly maxUnitsPerOrder: number;
  };
  readonly pricing: {
    readonly serviceFeeInCents: number;
    readonly freeShippingThresholdInCents: number;
  };
  readonly transactions: {
    readonly reservationTtlMinutes: number;
    readonly referencePrefix: string;
  };
  readonly payments: PaymentsConfig;
}

type Env = Readonly<Record<string, string | undefined>>;

const parseEnv = <T>(schema: z.ZodType<T>, env: Env): T => {
  const result = schema.safeParse(env);

  if (!result.success) {
    throw new InvalidConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
};

export const loadDynamoDbConnection = (env: Env): DynamoDbConnection => {
  const config = parseEnv(dynamoDbConnectionSchema, env);
  return { awsRegion: config.AWS_REGION, dynamodbEndpoint: config.DYNAMODB_ENDPOINT };
};

// The schema already checked that one of the two is set for the http provider.
const secretSource = (parameterName?: string, value?: string): SecretSource =>
  parameterName ? { parameterName } : { value: value ?? '' };

const toPaymentsConfig = (config: z.infer<typeof appConfigSchema>): PaymentsConfig =>
  config.PAYMENT_PROVIDER === 'fake'
    ? { provider: 'fake' }
    : {
        provider: 'http',
        apiBaseUrl: config.PAYMENT_API_BASE_URL ?? '',
        publicKey: config.PAYMENT_PUBLIC_KEY ?? '',
        privateKey: secretSource(config.PAYMENT_PRIVATE_KEY_PARAM, config.PAYMENT_PRIVATE_KEY),
        integritySecret: secretSource(
          config.PAYMENT_INTEGRITY_SECRET_PARAM,
          config.PAYMENT_INTEGRITY_SECRET,
        ),
        eventsSecret: secretSource(
          config.PAYMENT_EVENTS_SECRET_PARAM,
          config.PAYMENT_EVENTS_SECRET,
        ),
        eventsEnvironment: config.PAYMENT_EVENTS_ENVIRONMENT,
        timeoutMs: config.PAYMENT_HTTP_TIMEOUT_MS,
      };

export const loadAppConfig = (env: Env): AppConfig => {
  const config = parseEnv(appConfigSchema, env);

  return {
    appEnv: config.APP_ENV,
    appVersion: config.APP_VERSION,
    logLevel: config.LOG_LEVEL,
    port: config.PORT,
    corsAllowedOrigins: config.CORS_ALLOWED_ORIGINS,
    awsRegion: config.AWS_REGION,
    dynamodbEndpoint: config.DYNAMODB_ENDPOINT,
    tables: {
      products: config.TABLE_PRODUCTS,
      customers: config.TABLE_CUSTOMERS,
      transactions: config.TABLE_TRANSACTIONS,
      deliveries: config.TABLE_DELIVERIES,
      idempotency: config.TABLE_IDEMPOTENCY,
    },
    catalog: {
      lowStockThreshold: config.LOW_STOCK_THRESHOLD,
      maxUnitsPerOrder: config.MAX_UNITS_PER_ORDER,
    },
    pricing: {
      serviceFeeInCents: config.SERVICE_FEE_IN_CENTS,
      freeShippingThresholdInCents: config.FREE_SHIPPING_THRESHOLD_IN_CENTS,
    },
    transactions: {
      reservationTtlMinutes: config.STOCK_RESERVATION_TTL_MINUTES,
      referencePrefix: config.REFERENCE_PREFIX,
    },
    payments: toPaymentsConfig(config),
  };
};
