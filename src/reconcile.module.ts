import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { LoggingModule } from './shared/infrastructure/logging/logging.module';
import { SystemModule } from './shared/infrastructure/system/system.module';

@Module({
  imports: [ConfigModule, LoggingModule, SystemModule],
})
export class ReconcileModule {}
