import { Module } from '@nestjs/common';

import { ListCities } from '../application/list-cities.use-case';
import { ListDepartments } from '../application/list-departments.use-case';
import type { CoverageRepository } from '../domain/coverage.repository.port';

import { COVERAGE_REPOSITORY } from './coverage-repository.token';
import { LocationsController } from './http/locations.controller';
import { JsonCoverageRepository } from './json-coverage.repository';

@Module({
  controllers: [LocationsController],
  providers: [
    {
      provide: COVERAGE_REPOSITORY,
      useFactory: (): CoverageRepository => JsonCoverageRepository.fromBundledData(),
    },
    {
      provide: ListDepartments,
      inject: [COVERAGE_REPOSITORY],
      useFactory: (coverage: CoverageRepository) => new ListDepartments(coverage),
    },
    {
      provide: ListCities,
      inject: [COVERAGE_REPOSITORY],
      useFactory: (coverage: CoverageRepository) => new ListCities(coverage),
    },
  ],
})
export class CoverageModule {}
