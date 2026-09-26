import { Controller, Get, Header, Inject } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';
import type { Clock } from '../../../shared/domain/clock.port';
import { CLOCK } from '../../../shared/infrastructure/system/clock.token';

export interface HealthResponse {
  readonly status: 'ok';
  readonly version: string;
  readonly time: string;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  check(): HealthResponse {
    return {
      status: 'ok',
      version: this.config.appVersion,
      time: this.clock.now().toISOString(),
    };
  }
}
