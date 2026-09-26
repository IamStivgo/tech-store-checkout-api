import { resolveZoneCode, type ZoneRules } from './zone-resolution';

const rules: ZoneRules = {
  cityOverrides: new Map([
    ['11001', 'LOCAL'],
    ['91001', 'SPECIAL_ROUTE'],
    ['88001', 'NATIONAL_MAIN'],
  ]),
  departmentDefaults: new Map([['88', 'SPECIAL_ROUTE']]),
  fallback: 'NATIONAL_REGIONAL',
};

describe('resolveZoneCode', () => {
  it('uses the explicit zone of the city first', () => {
    expect(resolveZoneCode('11001', '11', rules)).toBe('LOCAL');
  });

  it('prefers the explicit city zone over the department default', () => {
    expect(resolveZoneCode('88001', '88', rules)).toBe('NATIONAL_MAIN');
  });

  it('uses the department default zone for cities without an explicit zone', () => {
    expect(resolveZoneCode('88564', '88', rules)).toBe('SPECIAL_ROUTE');
  });

  it('falls back to the default zone for everything else', () => {
    expect(resolveZoneCode('25307', '25', rules)).toBe('NATIONAL_REGIONAL');
  });
});
