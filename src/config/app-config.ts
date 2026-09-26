import { z } from 'zod';

import { InvalidConfigError } from './invalid-config.error';

const APP_ENVS = ['local', 'test', 'prod'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const DEFAULT_PORT = 3000;
const MAX_PORT = 65_535;
const DEFAULT_AWS_REGION = 'us-east-1';
const DEFAULT_LOW_STOCK_THRESHOLD = 3;
const DEFAULT_MAX_UNITS_PER_ORDER = 5;

const appConfigSchema = z.object({
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
  AWS_REGION: z.string().trim().min(1).default(DEFAULT_AWS_REGION),
  DYNAMODB_ENDPOINT: z.url().optional(),
  TABLE_PRODUCTS: z.string().trim().min(1),
  LOW_STOCK_THRESHOLD: z.coerce.number().int().min(0).default(DEFAULT_LOW_STOCK_THRESHOLD),
  MAX_UNITS_PER_ORDER: z.coerce.number().int().min(1).default(DEFAULT_MAX_UNITS_PER_ORDER),
});

export type AppEnv = (typeof APP_ENVS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfig {
  readonly appEnv: AppEnv;
  readonly appVersion: string;
  readonly logLevel: LogLevel;
  readonly port: number;
  readonly corsAllowedOrigins: readonly string[];
  readonly awsRegion: string;
  /** Only set locally, to point the SDK at DynamoDB Local. */
  readonly dynamodbEndpoint: string | undefined;
  readonly tables: {
    readonly products: string;
  };
  readonly catalog: {
    readonly lowStockThreshold: number;
    readonly maxUnitsPerOrder: number;
  };
}

export const loadAppConfig = (env: Readonly<Record<string, string | undefined>>): AppConfig => {
  const result = appConfigSchema.safeParse(env);

  if (!result.success) {
    throw new InvalidConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }

  const config = result.data;

  return {
    appEnv: config.APP_ENV,
    appVersion: config.APP_VERSION,
    logLevel: config.LOG_LEVEL,
    port: config.PORT,
    corsAllowedOrigins: config.CORS_ALLOWED_ORIGINS,
    awsRegion: config.AWS_REGION,
    dynamodbEndpoint: config.DYNAMODB_ENDPOINT,
    tables: { products: config.TABLE_PRODUCTS },
    catalog: {
      lowStockThreshold: config.LOW_STOCK_THRESHOLD,
      maxUnitsPerOrder: config.MAX_UNITS_PER_ORDER,
    },
  };
};
