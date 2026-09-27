import { unwrap } from '../../../../test/builders/unwrap';
import { CityNotSupportedError, DepartmentNotFoundError } from '../domain/coverage.errors';

import coverageData from './coverage-data.json';
import { InvalidCoverageDataError, JsonCoverageRepository } from './json-coverage.repository';

describe('JsonCoverageRepository', () => {
  const repository = JsonCoverageRepository.fromBundledData();

  const zoneOf = (cityCode: string) => unwrap(repository.findCity(cityCode)).zone.code;

  describe('findCity', () => {
    it.each([
      ['11001', 'Bogotá, D.C.', 'LOCAL'],
      ['25754', 'Soacha', 'METRO'],
      ['05001', 'Medellín', 'NATIONAL_MAIN'],
    ])('uses the explicit zone of %s (%s): %s', (cityCode, name, zone) => {
      expect(unwrap(repository.findCity(cityCode))).toMatchObject({ name });
      expect(zoneOf(cityCode)).toBe(zone);
    });

    it.each([
      ['91263', 'El Encanto'],
      ['91540', 'Puerto Nariño'],
    ])('uses the Amazonas default zone for %s (%s)', (cityCode) => {
      expect(zoneOf(cityCode)).toBe('SPECIAL_ROUTE');
    });

    it('uses the fallback zone for cities without explicit or department zone (Girardot)', () => {
      expect(zoneOf('25307')).toBe('NATIONAL_REGIONAL');
    });

    it('returns the complete zone with its rates', () => {
      const { zone } = unwrap(repository.findCity('11001'));

      expect(zone.baseRate.amountInCents).toBe(800_000);
      expect(zone.extraKgRate.amountInCents).toBe(150_000);
      expect(zone.freeShippingEligible).toBe(true);
      expect(zone.estimatedBusinessDays).toEqual({ min: 1, max: 1 });
    });

    it('answers CITY_NOT_SUPPORTED for unknown codes', () => {
      const result = repository.findCity('99999');

      expect(result.isErr && result.error).toBeInstanceOf(CityNotSupportedError);
    });
  });

  describe('listDepartments', () => {
    it('lists the 33 departments sorted by name', () => {
      const departments = repository.listDepartments();

      expect(departments).toHaveLength(33);
      expect(departments[0]).toEqual({ code: '91', name: 'Amazonas' });
      expect(departments.map((department) => department.name)).toContain('Valle del Cauca');
    });
  });

  describe('listCities', () => {
    it('lists the cities of a department sorted by name, with their zone', () => {
      const cities = unwrap(repository.listCities('05'));

      expect(cities).toHaveLength(125);
      expect(cities[0]?.name).toBe('Abejorral');
      expect(cities.find((city) => city.code === '05001')?.zone.code).toBe('NATIONAL_MAIN');
    });

    it('answers DEPARTMENT_NOT_FOUND for unknown departments', () => {
      const result = repository.listCities('00');

      expect(result.isErr && result.error).toBeInstanceOf(DepartmentNotFoundError);
    });
  });

  describe('invalid data', () => {
    const [firstZone, ...otherZones] = coverageData.zones;

    it.each([
      ['has an unknown shape', { ...coverageData, departments: 'none' }],
      [
        'has an invalid city code',
        {
          ...coverageData,
          departments: [{ code: '05', name: 'A', cities: [{ code: '5001', name: 'B' }] }],
        },
      ],
      [
        'has a negative rate',
        { ...coverageData, zones: [{ ...firstZone, baseRateInCents: -1 }, ...otherZones] },
      ],
      [
        'has an inverted delivery estimate',
        {
          ...coverageData,
          zones: [{ ...firstZone, estimatedBusinessDays: { min: 3, max: 1 } }, ...otherZones],
        },
      ],
      ['uses an undefined zone', { ...coverageData, zones: otherZones }],
    ])('fails at startup when the dataset %s', (_case, data) => {
      expect(() => new JsonCoverageRepository(data)).toThrow(InvalidCoverageDataError);
    });
  });
});
