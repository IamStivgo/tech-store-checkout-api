import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';

import { maskAllButLastFour } from './masking';

const COUNTRY_CODE = '+57';
// Mobile numbers start with 3; landlines with 60 plus the area digit (national numbering plan).
const NATIONAL_NUMBER = /^(?:3\d{9}|60\d{8})$/;
const SEPARATORS = /[\s-]/g;

export class ColombianPhone {
  private constructor(readonly value: string) {}

  /** Accepts spaces, hyphens and the +57 prefix; keeps the 10-digit national number. */
  static create(raw: string): Result<ColombianPhone, ValidationError> {
    const compact = raw.replace(SEPARATORS, '');
    const national = compact.startsWith(COUNTRY_CODE)
      ? compact.slice(COUNTRY_CODE.length)
      : compact;

    if (!NATIONAL_NUMBER.test(national)) {
      return err(
        ValidationError.forField(
          'phone',
          'phone must be a 10-digit Colombian number starting with 3 (mobile) or 60 (landline)',
        ),
      );
    }
    return ok(new ColombianPhone(national));
  }

  masked(): string {
    return maskAllButLastFour(this.value);
  }
}
