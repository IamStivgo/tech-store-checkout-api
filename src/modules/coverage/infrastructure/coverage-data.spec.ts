import coverageData from './coverage-data.json';

const ZONE_CODES = ['LOCAL', 'METRO', 'NATIONAL_MAIN', 'NATIONAL_REGIONAL', 'SPECIAL_ROUTE'];

const cities = coverageData.departments.flatMap((department) =>
  department.cities.map((city) => ({ ...city, departmentCode: department.code })),
);
const cityCodes = new Set(cities.map((city) => city.code));
const departmentCodes = new Set(coverageData.departments.map((department) => department.code));
const zoneCodes = new Set(coverageData.zones.map((zone) => zone.code));

describe('coverage dataset integrity', () => {
  it('holds the 33 departments and 1,122 municipalities of DIVIPOLA', () => {
    expect(coverageData.departments).toHaveLength(33);
    expect(cities).toHaveLength(1122);
  });

  it('has no duplicated department or city codes', () => {
    expect(departmentCodes.size).toBe(coverageData.departments.length);
    expect(cityCodes.size).toBe(cities.length);
  });

  it('only has cities whose DIVIPOLA code starts with their department code', () => {
    expect(cities.filter((city) => !city.code.startsWith(city.departmentCode))).toEqual([]);
  });

  it('defines the five delivery zones exactly once', () => {
    expect(coverageData.zones.map((zone) => zone.code).sort()).toEqual([...ZONE_CODES].sort());
  });

  it('only overrides cities that exist, with defined zones', () => {
    for (const [cityCode, zone] of Object.entries(coverageData.cityZoneOverrides)) {
      expect({ cityCode, exists: cityCodes.has(cityCode) }).toEqual({ cityCode, exists: true });
      expect(zoneCodes).toContain(zone);
    }
  });

  it('only sets department defaults for existing departments, with defined zones', () => {
    for (const [departmentCode, zone] of Object.entries(coverageData.departmentDefaultZones)) {
      expect(departmentCodes).toContain(departmentCode);
      expect(zoneCodes).toContain(zone);
    }
    expect(zoneCodes).toContain(coverageData.fallbackZone);
  });

  it('ships the warehouse in a covered city', () => {
    expect(cityCodes).toContain(coverageData.warehouseCityCode);
  });

  it('keeps the attribution required by the DIVIPOLA license', () => {
    expect(coverageData.source).toMatchObject({
      publisher: 'Departamento Administrativo Nacional de Estadística (DANE)',
      license: 'CC BY-SA 4.0',
    });
  });
});
