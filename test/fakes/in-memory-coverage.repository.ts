import {
  CityNotSupportedError,
  DepartmentNotFoundError,
} from '../../src/modules/coverage/domain/coverage.errors';
import type { CoverageRepository } from '../../src/modules/coverage/domain/coverage.repository.port';
import type { City, Department } from '../../src/modules/coverage/domain/location';
import { err, ok, type Result } from '../../src/shared/domain/result';

export class InMemoryCoverageRepository implements CoverageRepository {
  constructor(private readonly cities: readonly City[] = []) {}

  listDepartments(): Department[] {
    return [];
  }

  listCities(departmentCode: string): Result<City[], DepartmentNotFoundError> {
    const cities = this.cities.filter((city) => city.departmentCode === departmentCode);
    return cities.length > 0 ? ok(cities) : err(new DepartmentNotFoundError());
  }

  findCity(cityCode: string): Result<City, CityNotSupportedError> {
    const city = this.cities.find((candidate) => candidate.code === cityCode);
    return city ? ok(city) : err(new CityNotSupportedError());
  }
}
