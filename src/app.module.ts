import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { HealthModule } from './modules/health/infrastructure/health.module';
import { SystemModule } from './shared/infrastructure/system/system.module';

@Module({
  imports: [ConfigModule, SystemModule, HealthModule],
})
export class AppModule {}
