import type { ZoneCode } from './zone-code';

export interface ZoneRules {
  readonly cityOverrides: ReadonlyMap<string, ZoneCode>;
  readonly departmentDefaults: ReadonlyMap<string, ZoneCode>;
  readonly fallback: ZoneCode;
}

/** BR-10: explicit city zone, else the department default zone, else the fallback zone. */
export const resolveZoneCode = (
  cityCode: string,
  departmentCode: string,
  rules: ZoneRules,
): ZoneCode =>
  rules.cityOverrides.get(cityCode) ??
  rules.departmentDefaults.get(departmentCode) ??
  rules.fallback;
