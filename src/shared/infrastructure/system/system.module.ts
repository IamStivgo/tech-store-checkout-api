import { Global, Module } from '@nestjs/common';

import { CLOCK } from './clock.token';
import { CryptoIdGenerator } from './crypto-id-generator';
import { ID_GENERATOR } from './id-generator.token';
import { SLEEPER } from './sleeper.token';
import { SystemClock } from './system-clock';
import { SystemSleeper } from './system-sleeper';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: SLEEPER, useClass: SystemSleeper },
  ],
  exports: [CLOCK, ID_GENERATOR, SLEEPER],
})
export class SystemModule {}
