import { Controller, Get, Header, Param } from '@nestjs/common';

import { toHttpResponse } from '../../../../shared/infrastructure/http/to-http-response';
import { ListCities, type CityView } from '../../application/list-cities.use-case';
import { ListDepartments } from '../../application/list-departments.use-case';
import type { Department } from '../../domain/location';

import { DepartmentCodePipe } from './department-code.pipe';

// Reference data that barely changes: browsers and CloudFront may cache it for a day.
const REFERENCE_DATA_CACHE = 'public, max-age=86400';

export interface ListResponse<T> {
  readonly data: readonly T[];
  readonly meta: { readonly count: number };
}

const toListResponse = <T>(items: readonly T[]): ListResponse<T> => ({
  data: items,
  meta: { count: items.length },
});

@Controller('locations/departments')
export class LocationsController {
  constructor(
    private readonly listDepartments: ListDepartments,
    private readonly listCities: ListCities,
  ) {}

  @Get()
  @Header('Cache-Control', REFERENCE_DATA_CACHE)
  async departments(): Promise<ListResponse<Department>> {
    return toListResponse(await toHttpResponse(this.listDepartments.execute()));
  }

  @Get(':departmentCode/cities')
  @Header('Cache-Control', REFERENCE_DATA_CACHE)
  async cities(
    @Param('departmentCode', DepartmentCodePipe) departmentCode: string,
  ): Promise<ListResponse<CityView>> {
    return toListResponse(await toHttpResponse(this.listCities.execute(departmentCode)));
  }
}
