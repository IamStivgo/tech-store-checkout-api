import { z } from 'zod';

import { Money } from '../../../shared/domain/money.vo';
import { err, ok, type Result } from '../../../shared/domain/result';
import { CityNotSupportedError, DepartmentNotFoundError } from '../domain/coverage.errors';
import type { CoverageRepository } from '../domain/coverage.repository.port';
import { DeliveryZone } from '../domain/delivery-zone.vo';
import type { City, Department } from '../domain/location';
import { ZONE_CODES, type ZoneCode } from '../domain/zone-code';
import { resolveZoneCode, type ZoneRules } from '../domain/zone-resolution';

import coverageData from './coverage-data.json';

const zoneCodeSchema = z.enum(ZONE_CODES);

const coverageDataSchema = z.object({
  includedWeightKg: z.number().int().min(0),
  zones: z.array(
    z.object({
      code: zoneCodeSchema,
      baseRateInCents: z.number(),
      extraKgRateInCents: z.number(),
      freeShippingEligible: z.boolean(),
      estimatedBusinessDays: z.object({ min: z.number(), max: z.number() }),
    }),
  ),
  departmentDefaultZones: z.record(z.string(), zoneCodeSchema),
  fallbackZone: zoneCodeSchema,
  cityZoneOverrides: z.record(z.string(), zoneCodeSchema),
  departments: z
    .array(
      z.object({
        code: z.string().regex(/^\d{2}$/),
        name: z.string().min(1),
        cities: z
          .array(z.object({ code: z.string().regex(/^\d{5}$/), name: z.string().min(1) }))
          .min(1),
      }),
    )
    .min(1),
});

type ZoneData = z.infer<typeof coverageDataSchema>['zones'][number];

export class InvalidCoverageDataError extends Error {
  constructor(detail: string) {
    super(`Invalid coverage data: ${detail}`);
    this.name = 'InvalidCoverageDataError';
  }
}

const byName = <T extends { readonly name: string }>(first: T, second: T): number =>
  first.name.localeCompare(second.name, 'es');

const toDeliveryZone = (zone: ZoneData): DeliveryZone =>
  Money.create(zone.baseRateInCents)
    .andThen((baseRate) =>
      Money.create(zone.extraKgRateInCents).map((extraKgRate) => ({ baseRate, extraKgRate })),
    )
    .andThen(({ baseRate, extraKgRate }) =>
      DeliveryZone.create({
        code: zone.code,
        baseRate,
        extraKgRate,
        freeShippingEligible: zone.freeShippingEligible,
        estimatedBusinessDays: zone.estimatedBusinessDays,
      }),
    )
    .match({
      ok: (deliveryZone) => deliveryZone,
      err: (error) => {
        throw new InvalidCoverageDataError(
          `zone ${zone.code}: ${JSON.stringify(error.fieldErrors)}`,
        );
      },
    });

/**
 * Coverage reference data (DIVIPOLA + delivery zones) validated and resolved once at startup,
 * so every lookup is an in-memory read.
 */
export class JsonCoverageRepository implements CoverageRepository {
  private readonly departments: Department[];
  private readonly citiesByDepartment = new Map<string, City[]>();
  private readonly citiesByCode = new Map<string, City>();
  /** Weight covered by every zone's base rate (BR-04), versioned with the zone table. */
  readonly includedWeightKg: number;

  constructor(data: unknown) {
    const parsed = coverageDataSchema.safeParse(data);
    if (!parsed.success) {
      throw new InvalidCoverageDataError(parsed.error.message);
    }

    this.includedWeightKg = parsed.data.includedWeightKg;
    const zones = new Map(parsed.data.zones.map((zone) => [zone.code, toDeliveryZone(zone)]));
    const rules: ZoneRules = {
      cityOverrides: new Map(Object.entries(parsed.data.cityZoneOverrides)),
      departmentDefaults: new Map(Object.entries(parsed.data.departmentDefaultZones)),
      fallback: parsed.data.fallbackZone,
    };
    const zoneFor = (code: ZoneCode): DeliveryZone => {
      const zone = zones.get(code);
      if (!zone) {
        throw new InvalidCoverageDataError(`zone ${code} is used but not defined`);
      }
      return zone;
    };

    this.departments = parsed.data.departments
      .map(({ code, name }) => ({ code, name }))
      .toSorted(byName);

    for (const department of parsed.data.departments) {
      const cities = department.cities
        .map((city): City => ({
          code: city.code,
          name: city.name,
          departmentCode: department.code,
          zone: zoneFor(resolveZoneCode(city.code, department.code, rules)),
        }))
        .toSorted(byName);

      this.citiesByDepartment.set(department.code, cities);
      cities.forEach((city) => this.citiesByCode.set(city.code, city));
    }
  }

  static fromBundledData(): JsonCoverageRepository {
    return new JsonCoverageRepository(coverageData);
  }

  listDepartments(): Department[] {
    return [...this.departments];
  }

  listCities(departmentCode: string): Result<City[], DepartmentNotFoundError> {
    const cities = this.citiesByDepartment.get(departmentCode);
    return cities ? ok([...cities]) : err(new DepartmentNotFoundError());
  }

  findCity(cityCode: string): Result<City, CityNotSupportedError> {
    const city = this.citiesByCode.get(cityCode);
    return city ? ok(city) : err(new CityNotSupportedError());
  }
}
