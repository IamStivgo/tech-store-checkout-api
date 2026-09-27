import { Controller, Get, Header, HttpStatus, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ApiProblemResponses } from '../../../../shared/infrastructure/http/openapi/problem-details.openapi';
import { toHttpResponse } from '../../../../shared/infrastructure/http/to-http-response';
import { ListCities, type CityView } from '../../application/list-cities.use-case';
import { ListDepartments } from '../../application/list-departments.use-case';
import type { Department } from '../../domain/location';

import { DepartmentCodePipe } from './department-code.pipe';
import { toListResponse, type ListResponse } from './list-response';
import { CityListSchema, DepartmentListSchema } from './location.openapi';

// Reference data that barely changes: browsers and CloudFront may cache it for a day.
const REFERENCE_DATA_CACHE = 'public, max-age=86400';

@ApiTags('Locations')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller('locations/departments')
export class LocationsController {
  constructor(
    private readonly listDepartments: ListDepartments,
    private readonly listCities: ListCities,
  ) {}

  @Get()
  @Header('Cache-Control', REFERENCE_DATA_CACHE)
  @ApiOperation({ summary: 'List the Colombian departments (DIVIPOLA) sorted by name' })
  @ApiOkResponse({ type: DepartmentListSchema })
  async departments(): Promise<ListResponse<Department>> {
    return toListResponse(await toHttpResponse(this.listDepartments.execute()));
  }

  @Get(':departmentCode/cities')
  @Header('Cache-Control', REFERENCE_DATA_CACHE)
  @ApiOperation({ summary: 'List the municipalities of a department with their delivery zone' })
  @ApiParam({ name: 'departmentCode', description: 'Two-digit DIVIPOLA code.', example: '05' })
  @ApiOkResponse({ type: CityListSchema })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async cities(
    @Param('departmentCode', DepartmentCodePipe) departmentCode: string,
  ): Promise<ListResponse<CityView>> {
    return toListResponse(await toHttpResponse(this.listCities.execute(departmentCode)));
  }
}
