import { unwrap } from '../../../../test/builders/unwrap';
import { Money } from '../../../shared/domain/money.vo';
import { err, ok } from '../../../shared/domain/result';
import { CityNotSupportedError, DepartmentNotFoundError } from '../domain/coverage.errors';
import type { CoverageRepository } from '../domain/coverage.repository.port';
import { DeliveryZone } from '../domain/delivery-zone.vo';
import type { City } from '../domain/location';

import { ListCities } from './list-cities.use-case';
import { ListDepartments } from './list-departments.use-case';

const metro = unwrap(
  DeliveryZone.create({
    code: 'METRO',
    baseRate: unwrap(Money.create(1_200_000)),
    extraKgRate: unwrap(Money.create(200_000)),
    freeShippingEligible: true,
    estimatedBusinessDays: { min: 1, max: 2 },
  }),
);
const soacha: City = { code: '25754', name: 'Soacha', departmentCode: '25', zone: metro };

const coverage: CoverageRepository = {
  listDepartments: () => [{ code: '25', name: 'Cundinamarca' }],
  listCities: (code) => (code === '25' ? ok([soacha]) : err(new DepartmentNotFoundError())),
  findCity: () => err(new CityNotSupportedError()),
};

describe('ListDepartments', () => {
  it('lists every department', () => {
    expect(unwrap(new ListDepartments(coverage).execute())).toEqual([
      { code: '25', name: 'Cundinamarca' },
    ]);
  });
});

describe('ListCities', () => {
  it('lists the cities of the department with their zone code', () => {
    expect(unwrap(new ListCities(coverage).execute('25'))).toEqual([
      { code: '25754', name: 'Soacha', zone: 'METRO' },
    ]);
  });

  it('answers DEPARTMENT_NOT_FOUND for unknown departments', () => {
    const result = new ListCities(coverage).execute('00');

    expect(result.isErr && result.error).toBeInstanceOf(DepartmentNotFoundError);
  });
});
