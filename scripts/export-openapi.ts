import { writeFileSync } from 'node:fs';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import type { AppConfig } from '../src/config/app-config';
import { APP_CONFIG } from '../src/config/app-config.token';
import { configureApp } from '../src/shared/infrastructure/http/configure-app';
import {
  createOpenApiDocument,
  serializeOpenApiDocument,
} from '../src/shared/infrastructure/http/openapi/openapi-document';

import { contractVersion, OPENAPI_FILE } from './openapi/contract';

// The document only depends on controllers and decorators: no AWS access is needed.
const EXPORT_ENV = {
  APP_ENV: 'local',
  LOG_LEVEL: 'silent',
  TABLE_PRODUCTS: 'openapi-export',
  TABLE_CUSTOMERS: 'openapi-export',
  TABLE_IDEMPOTENCY: 'openapi-export',
};

const main = async (): Promise<void> => {
  Object.assign(process.env, { ...EXPORT_ENV, ...process.env });
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app, app.get<AppConfig>(APP_CONFIG));

  writeFileSync(
    OPENAPI_FILE,
    serializeOpenApiDocument(createOpenApiDocument(app, contractVersion())),
  );
  await app.close();
  console.log(`OpenAPI contract written to ${OPENAPI_FILE}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
