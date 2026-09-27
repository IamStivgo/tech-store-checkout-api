import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import type { HealthResponse } from './health.response';

@ApiSchema({ name: 'Health' })
export class HealthSchema implements HealthResponse {
  @ApiProperty({ enum: ['ok'] })
  readonly status!: 'ok';

  @ApiProperty({ description: 'Deployed application version.', example: '0.1.0' })
  readonly version!: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-27T15:00:00.000Z' })
  readonly time!: string;
}
