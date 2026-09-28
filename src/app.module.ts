import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { CoverageModule } from './modules/coverage/infrastructure/coverage.module';
import { CustomersModule } from './modules/customers/infrastructure/customers.module';
import { HealthModule } from './modules/health/infrastructure/health.module';
import { PaymentsModule } from './modules/payments/infrastructure/payments.module';
import { PricingModule } from './modules/pricing/infrastructure/pricing.module';
import { ProductsModule } from './modules/products/infrastructure/products.module';
import { IdempotencyModule } from './shared/infrastructure/idempotency/idempotency.module';
import { LoggingModule } from './shared/infrastructure/logging/logging.module';
import { PersistenceModule } from './shared/infrastructure/persistence/persistence.module';
import { SystemModule } from './shared/infrastructure/system/system.module';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    SystemModule,
    PersistenceModule,
    IdempotencyModule,
    HealthModule,
    ProductsModule,
    CoverageModule,
    PricingModule,
    CustomersModule,
    PaymentsModule,
  ],
})
export class AppModule {}
