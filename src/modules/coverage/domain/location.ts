import type { DeliveryZone } from './delivery-zone.vo';

export interface Department {
  /** Two-digit DIVIPOLA department code. */
  readonly code: string;
  readonly name: string;
}

export interface City {
  /** Five-digit DIVIPOLA municipality code. */
  readonly code: string;
  readonly name: string;
  readonly departmentCode: string;
  readonly zone: DeliveryZone;
}
