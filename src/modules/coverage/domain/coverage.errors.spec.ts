import { CityNotSupportedError, DepartmentNotFoundError } from './coverage.errors';

describe('coverage errors', () => {
  it('reports unsupported cities with CITY_NOT_SUPPORTED', () => {
    expect(new CityNotSupportedError()).toMatchObject({
      code: 'CITY_NOT_SUPPORTED',
      detail: 'We do not deliver to the selected city.',
    });
  });

  it('reports unknown departments with DEPARTMENT_NOT_FOUND', () => {
    expect(new DepartmentNotFoundError()).toMatchObject({
      code: 'DEPARTMENT_NOT_FOUND',
      detail: 'The department does not exist.',
    });
  });
});
