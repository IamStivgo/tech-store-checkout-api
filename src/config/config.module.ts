import { Global, Module } from '@nestjs/common';

import { loadAppConfig } from './app-config';
import { APP_CONFIG } from './app-config.token';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadAppConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
