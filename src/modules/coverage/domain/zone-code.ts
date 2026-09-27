export const ZONE_CODES = [
  'LOCAL',
  'METRO',
  'NATIONAL_MAIN',
  'NATIONAL_REGIONAL',
  'SPECIAL_ROUTE',
] as const;

export type ZoneCode = (typeof ZONE_CODES)[number];
