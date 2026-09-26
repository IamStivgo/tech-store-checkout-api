import type { Money } from '../../../shared/domain/money.vo';
import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';

import type { ZoneCode } from './zone-code';

export interface BusinessDaysRange {
  readonly min: number;
  readonly max: number;
}

export interface DeliveryZoneProps {
  readonly code: ZoneCode;
  /** Delivery fee covering the included weight. */
  readonly baseRate: Money;
  /** Fee for each additional kilogram, rounded up. */
  readonly extraKgRate: Money;
  /** Whether orders above the free shipping threshold ship for free (special routes never do). */
  readonly freeShippingEligible: boolean;
  readonly estimatedBusinessDays: BusinessDaysRange;
}

const isValidRange = ({ min, max }: BusinessDaysRange): boolean =>
  Number.isSafeInteger(min) && Number.isSafeInteger(max) && min >= 0 && min <= max;

export class DeliveryZone {
  readonly code: ZoneCode;
  readonly baseRate: Money;
  readonly extraKgRate: Money;
  readonly freeShippingEligible: boolean;
  readonly estimatedBusinessDays: BusinessDaysRange;

  private constructor(props: DeliveryZoneProps) {
    this.code = props.code;
    this.baseRate = props.baseRate;
    this.extraKgRate = props.extraKgRate;
    this.freeShippingEligible = props.freeShippingEligible;
    this.estimatedBusinessDays = props.estimatedBusinessDays;
  }

  static create(props: DeliveryZoneProps): Result<DeliveryZone, ValidationError> {
    if (!isValidRange(props.estimatedBusinessDays)) {
      return err(
        ValidationError.forField(
          'estimatedBusinessDays',
          'estimatedBusinessDays must be whole days with min <= max',
        ),
      );
    }
    return ok(new DeliveryZone(props));
  }
}
