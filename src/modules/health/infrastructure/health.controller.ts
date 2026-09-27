import { Controller, Get, Header, HttpStatus, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';
import type { Clock } from '../../../shared/domain/clock.port';
import { ApiProblemResponses } from '../../../shared/infrastructure/http/openapi/problem-details.openapi';
import { CLOCK } from '../../../shared/infrastructure/system/clock.token';

import { HealthSchema } from './health.openapi';
import type { HealthResponse } from './health.response';

@ApiTags('Health')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller('health')
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Liveness check with the deployed version' })
  @ApiOkResponse({ type: HealthSchema })
  check(): HealthResponse {
    return {
      status: 'ok',
      version: this.config.appVersion,
      time: this.clock.now().toISOString(),
    };
  }
}
