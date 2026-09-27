import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { CoverageModule } from './modules/coverage/infrastructure/coverage.module';
import { HealthModule } from './modules/health/infrastructure/health.module';
import { PricingModule } from './modules/pricing/infrastructure/pricing.module';
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
    CoverageModule,
    PricingModule,
  ],
})
export class AppModule {}
