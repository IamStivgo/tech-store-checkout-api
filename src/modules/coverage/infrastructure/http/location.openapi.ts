import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ListMetaSchema } from '../../../../shared/infrastructure/http/openapi/common.openapi';
import type { CityView } from '../../application/list-cities.use-case';
import type { Department } from '../../domain/location';
import { ZONE_CODES, type ZoneCode } from '../../domain/zone-code';

import type { ListResponse } from './list-response';

@ApiSchema({ name: 'Department' })
export class DepartmentSchema implements Department {
  @ApiProperty({ description: 'Two-digit DIVIPOLA department code.', example: '05' })
  readonly code!: string;

  @ApiProperty({ example: 'Antioquia' })
  readonly name!: string;
}

@ApiSchema({ name: 'City' })
export class CitySchema implements CityView {
  @ApiProperty({ description: 'Five-digit DIVIPOLA municipality code.', example: '05001' })
  readonly code!: string;

  @ApiProperty({ example: 'Medellín' })
  readonly name!: string;

  @ApiProperty({ enum: ZONE_CODES, description: 'Delivery zone used to price shipping.' })
  readonly zone!: ZoneCode;
}

@ApiSchema({ name: 'DepartmentList' })
export class DepartmentListSchema implements ListResponse<Department> {
  @ApiProperty({ type: [DepartmentSchema] })
  readonly data!: readonly Department[];

  @ApiProperty({ type: ListMetaSchema })
  readonly meta!: ListMetaSchema;
}

@ApiSchema({ name: 'CityList' })
export class CityListSchema implements ListResponse<CityView> {
  @ApiProperty({ type: [CitySchema] })
  readonly data!: readonly CityView[];

  @ApiProperty({ type: ListMetaSchema })
  readonly meta!: ListMetaSchema;
}
