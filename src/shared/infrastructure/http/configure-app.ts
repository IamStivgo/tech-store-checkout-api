import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import type { AppConfig } from '../../../config/app-config';

import { ProblemDetailsFilter } from './problem-details.filter';
import { assignRequestId, JSON_CONTENT_TYPES, rejectNonJsonBody } from './request-guards';

export const GLOBAL_PREFIX = 'api';
export const DEFAULT_API_VERSION = '1';
/** Largest accepted JSON body (security design §5); larger ones get 413. */
export const MAX_BODY_SIZE = '16kb';
const TWO_YEARS_IN_SECONDS = 63_072_000;

// Security headers for JSON responses (security design §6.2).
const helmetOptions: Parameters<typeof helmet>[0] = {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  strictTransportSecurity: { maxAge: TWO_YEARS_IN_SECONDS, includeSubDomains: true },
};

/**
 * Registered before the app initializes, so these middlewares run before the ones of Nest
 * modules (the logger) and the default body parsers.
 */
export const configureApp = (app: NestExpressApplication, config: AppConfig): void => {
  app.useLogger(app.get(Logger));
  app.use(assignRequestId);
  app.use(helmet(helmetOptions));
  app.use(rejectNonJsonBody);
  app.useBodyParser('json', { limit: MAX_BODY_SIZE, type: JSON_CONTENT_TYPES });
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: DEFAULT_API_VERSION });
  app.useGlobalFilters(new ProblemDetailsFilter());

  if (config.corsAllowedOrigins.length > 0) {
    app.enableCors({ origin: [...config.corsAllowedOrigins] });
  }
};
