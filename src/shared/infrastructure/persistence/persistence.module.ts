import { Global, Module } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';

import { createDynamoDbDocumentClient } from './dynamodb-client.factory';
import { DYNAMODB_DOCUMENT_CLIENT } from './dynamodb-document-client.token';

@Global()
@Module({
  providers: [
    {
      provide: DYNAMODB_DOCUMENT_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createDynamoDbDocumentClient(config),
    },
  ],
  exports: [DYNAMODB_DOCUMENT_CLIENT],
})
export class PersistenceModule {}
