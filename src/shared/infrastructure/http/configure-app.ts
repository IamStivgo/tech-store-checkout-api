import { VersioningType, type INestApplication } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';

export const GLOBAL_PREFIX = 'api';
export const DEFAULT_API_VERSION = '1';

export const configureApp = (app: INestApplication, config: AppConfig): void => {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: DEFAULT_API_VERSION });

  if (config.corsAllowedOrigins.length > 0) {
    app.enableCors({ origin: [...config.corsAllowedOrigins] });
  }
};
