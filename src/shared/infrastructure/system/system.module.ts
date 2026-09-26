import { Global, Module } from '@nestjs/common';

import { CLOCK } from './clock.token';
import { CryptoIdGenerator } from './crypto-id-generator';
import { ID_GENERATOR } from './id-generator.token';
import { SystemClock } from './system-clock';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
  ],
  exports: [CLOCK, ID_GENERATOR],
})
export class SystemModule {}
