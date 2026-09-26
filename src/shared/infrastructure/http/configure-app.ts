import { VersioningType, type INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import type { AppConfig } from '../../../config/app-config';

import { ProblemDetailsFilter } from './problem-details.filter';

export const GLOBAL_PREFIX = 'api';
export const DEFAULT_API_VERSION = '1';

export const configureApp = (app: INestApplication, config: AppConfig): void => {
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: DEFAULT_API_VERSION });
  app.useGlobalFilters(new ProblemDetailsFilter());

  if (config.corsAllowedOrigins.length > 0) {
    app.enableCors({ origin: [...config.corsAllowedOrigins] });
  }
};
