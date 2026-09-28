import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { TransactionsModule } from './modules/transactions/infrastructure/transactions.module';
import { IdempotencyModule } from './shared/infrastructure/idempotency/idempotency.module';
import { LoggingModule } from './shared/infrastructure/logging/logging.module';
import { PersistenceModule } from './shared/infrastructure/persistence/persistence.module';
import { SystemModule } from './shared/infrastructure/system/system.module';

@Module({
  // The transactions module brings its HTTP controllers, which need the idempotency module.
  imports: [
    ConfigModule,
    LoggingModule,
    SystemModule,
    PersistenceModule,
    IdempotencyModule,
    TransactionsModule,
  ],
})
export class ReconcileModule {}
