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

// Connection settings shared by the app and the scripts that only touch one table (seed).
const dynamoDbConnectionSchema = z.object({
  AWS_REGION: z.string().trim().min(1).default(DEFAULT_AWS_REGION),
  DYNAMODB_ENDPOINT: z.url().optional(),
});

const appConfigSchema = dynamoDbConnectionSchema.extend({
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
  TABLE_IDEMPOTENCY: z.string().trim().min(1),
  LOW_STOCK_THRESHOLD: z.coerce.number().int().min(0).default(DEFAULT_LOW_STOCK_THRESHOLD),
  MAX_UNITS_PER_ORDER: z.coerce.number().int().min(1).default(DEFAULT_MAX_UNITS_PER_ORDER),
  SERVICE_FEE_IN_CENTS: z.coerce.number().int().min(0).default(DEFAULT_SERVICE_FEE_IN_CENTS),
  FREE_SHIPPING_THRESHOLD_IN_CENTS: z.coerce
    .number()
    .int()
    .min(0)
    .default(DEFAULT_FREE_SHIPPING_THRESHOLD_IN_CENTS),
});

export type AppEnv = (typeof APP_ENVS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface DynamoDbConnection {
  readonly awsRegion: string;
  /** Only set locally, to point the SDK at DynamoDB Local. */
  readonly dynamodbEndpoint: string | undefined;
}

export interface AppConfig extends DynamoDbConnection {
  readonly appEnv: AppEnv;
  readonly appVersion: string;
  readonly logLevel: LogLevel;
  readonly port: number;
  readonly corsAllowedOrigins: readonly string[];
  readonly tables: {
    readonly products: string;
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
    tables: { products: config.TABLE_PRODUCTS, idempotency: config.TABLE_IDEMPOTENCY },
    catalog: {
      lowStockThreshold: config.LOW_STOCK_THRESHOLD,
      maxUnitsPerOrder: config.MAX_UNITS_PER_ORDER,
    },
    pricing: {
      serviceFeeInCents: config.SERVICE_FEE_IN_CENTS,
      freeShippingThresholdInCents: config.FREE_SHIPPING_THRESHOLD_IN_CENTS,
    },
  };
};
