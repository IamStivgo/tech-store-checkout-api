import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { HealthModule } from './modules/health/infrastructure/health.module';
import { ProductsModule } from './modules/products/infrastructure/products.module';
import { LoggingModule } from './shared/infrastructure/logging/logging.module';
import { PersistenceModule } from './shared/infrastructure/persistence/persistence.module';
import { SystemModule } from './shared/infrastructure/system/system.module';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    SystemModule,
    PersistenceModule,
    HealthModule,
    ProductsModule,
  ],
})
export class AppModule {}
