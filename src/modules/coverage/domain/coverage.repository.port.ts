import type { Result } from '../../../shared/domain/result';

import type { CityNotSupportedError, DepartmentNotFoundError } from './coverage.errors';
import type { City, Department } from './location';

/** Reference data loaded in memory, so the operations are synchronous. */
export interface CoverageRepository {
  listDepartments(): Department[];
  listCities(departmentCode: string): Result<City[], DepartmentNotFoundError>;
  findCity(cityCode: string): Result<City, CityNotSupportedError>;
}
