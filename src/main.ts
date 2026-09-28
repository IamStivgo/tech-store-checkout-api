import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import type { AppConfig } from './config/app-config';
import { APP_CONFIG } from './config/app-config.token';
import { configureApp } from './shared/infrastructure/http/configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);

  configureApp(app, config);
  await app.listen(config.port);
}

void bootstrap();
