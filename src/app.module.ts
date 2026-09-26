import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { HealthModule } from './modules/health/infrastructure/health.module';
import { LoggingModule } from './shared/infrastructure/logging/logging.module';
import { SystemModule } from './shared/infrastructure/system/system.module';

@Module({
  imports: [ConfigModule, LoggingModule, SystemModule, HealthModule],
})
export class AppModule {}
