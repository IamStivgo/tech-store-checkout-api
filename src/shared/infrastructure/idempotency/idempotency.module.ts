import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Global, Module } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';
import type { IdempotencyRecordRepository } from '../../application/idempotency-record.repository.port';
import { IdempotencyService } from '../../application/idempotency.service';
import type { Clock } from '../../domain/clock.port';
import { DYNAMODB_DOCUMENT_CLIENT } from '../persistence/dynamodb-document-client.token';
import { DynamoDbIdempotencyRepository } from '../persistence/dynamodb-idempotency.repository';
import { CLOCK } from '../system/clock.token';

import { IDEMPOTENCY_RECORD_REPOSITORY } from './idempotency-record-repository.token';

/** Provides the service used by `@Idempotent()` endpoints of any module. */
@Global()
@Module({
  providers: [
    {
      provide: IDEMPOTENCY_RECORD_REPOSITORY,
      inject: [DYNAMODB_DOCUMENT_CLIENT, APP_CONFIG],
      useFactory: (
        client: DynamoDBDocumentClient,
        config: AppConfig,
      ): IdempotencyRecordRepository =>
        new DynamoDbIdempotencyRepository(client, config.tables.idempotency),
    },
    {
      provide: IdempotencyService,
      inject: [IDEMPOTENCY_RECORD_REPOSITORY, CLOCK],
      useFactory: (records: IdempotencyRecordRepository, clock: Clock) =>
        new IdempotencyService(records, clock),
    },
  ],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
