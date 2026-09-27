import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';

import { maskAllButLastFour } from './masking';

export const LEGAL_ID_TYPES = ['CC', 'CE', 'NIT', 'PP'] as const;
export type LegalIdType = (typeof LEGAL_ID_TYPES)[number];

const RULES: Readonly<Record<LegalIdType, { readonly pattern: RegExp; readonly message: string }>> =
  {
    CC: { pattern: /^\d{5,10}$/, message: 'a CC must have 5 to 10 digits' },
    CE: { pattern: /^[A-Z0-9]{6,10}$/, message: 'a CE must have 6 to 10 letters or digits' },
    NIT: {
      pattern: /^\d{9}(?:-?\d)?$/,
      message: 'a NIT must have 9 digits and an optional check digit',
    },
    PP: { pattern: /^[A-Z0-9]{6,12}$/, message: 'a PP must have 6 to 12 letters or digits' },
  };
const NIT_BASE_LENGTH = 9;
// Thousands separators and spaces are common when people type a document number.
const SEPARATORS = /[\s.]/g;

const isLegalIdType = (value: string): value is LegalIdType =>
  (LEGAL_ID_TYPES as readonly string[]).includes(value);

// 9001234567 and 900123456-7 are the same NIT: the check digit is always kept after a hyphen.
const canonicalNit = (value: string): string => {
  const digits = value.replace('-', '');
  const checkDigit = digits.slice(NIT_BASE_LENGTH);
  return checkDigit ? `${digits.slice(0, NIT_BASE_LENGTH)}-${checkDigit}` : digits;
};

export class LegalId {
  private constructor(
    readonly type: LegalIdType,
    readonly number: string,
  ) {}

  static create(type: string, rawNumber: string): Result<LegalId, ValidationError> {
    if (!isLegalIdType(type)) {
      return err(
        ValidationError.forField(
          'legalIdType',
          `legalIdType must be one of ${LEGAL_ID_TYPES.join(', ')}`,
        ),
      );
    }

    const number = rawNumber.replace(SEPARATORS, '').toUpperCase();
    const rule = RULES[type];

    if (!rule.pattern.test(number)) {
      return err(ValidationError.forField('legalId', rule.message));
    }
    return ok(new LegalId(type, type === 'NIT' ? canonicalNit(number) : number));
  }

  maskedNumber(): string {
    return maskAllButLastFour(this.number);
  }
}
