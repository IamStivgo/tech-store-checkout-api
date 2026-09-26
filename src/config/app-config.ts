import { z } from 'zod';

import { InvalidConfigError } from './invalid-config.error';

const APP_ENVS = ['local', 'test', 'prod'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const DEFAULT_PORT = 3000;
const MAX_PORT = 65_535;

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
});

export type AppEnv = (typeof APP_ENVS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfig {
  readonly appEnv: AppEnv;
  readonly appVersion: string;
  readonly logLevel: LogLevel;
  readonly port: number;
  readonly corsAllowedOrigins: readonly string[];
}

export const loadAppConfig = (env: Readonly<Record<string, string | undefined>>): AppConfig => {
  const result = appConfigSchema.safeParse(env);

  if (!result.success) {
    throw new InvalidConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }

  const { APP_ENV, APP_VERSION, LOG_LEVEL, PORT, CORS_ALLOWED_ORIGINS } = result.data;

  return {
    appEnv: APP_ENV,
    appVersion: APP_VERSION,
    logLevel: LOG_LEVEL,
    port: PORT,
    corsAllowedOrigins: CORS_ALLOWED_ORIGINS,
  };
};
