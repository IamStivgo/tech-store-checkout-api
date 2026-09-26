import type { Result } from '../../../shared/domain/result';
import type { DepartmentNotFoundError } from '../domain/coverage.errors';
import type { CoverageRepository } from '../domain/coverage.repository.port';
import type { ZoneCode } from '../domain/zone-code';

export interface CityView {
  readonly code: string;
  readonly name: string;
  readonly zone: ZoneCode;
}

export class ListCities {
  constructor(private readonly coverage: CoverageRepository) {}

  execute(departmentCode: string): Result<CityView[], DepartmentNotFoundError> {
    return this.coverage
      .listCities(departmentCode)
      .map((cities) => cities.map(({ code, name, zone }) => ({ code, name, zone: zone.code })));
  }
}
