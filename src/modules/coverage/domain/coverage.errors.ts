import { DomainError } from '../../../shared/domain/domain-error';

export class CityNotSupportedError extends DomainError {
  readonly code = 'CITY_NOT_SUPPORTED';

  constructor() {
    super('We do not deliver to the selected city.');
  }
}

export class DepartmentNotFoundError extends DomainError {
  readonly code = 'DEPARTMENT_NOT_FOUND';

  constructor() {
    super('The department does not exist.');
  }
}
