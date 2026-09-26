import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';

import { buildLoggerParams } from './logger-params';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => buildLoggerParams(config),
    }),
  ],
})
export class LoggingModule {}
