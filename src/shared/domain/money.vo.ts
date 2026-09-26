import { err, ok, type Result } from './result';
import { ValidationError } from './validation-error';

export const SUPPORTED_CURRENCIES = ['COP'] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export interface MoneyJson {
  readonly amountInCents: number;
  readonly currency: Currency;
}

const isNonNegativeInteger = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

const isSupportedCurrency = (value: string): value is Currency =>
  (SUPPORTED_CURRENCIES as readonly string[]).includes(value);

export class Money {
  private constructor(
    readonly amountInCents: number,
    readonly currency: Currency,
  ) {}

  static create(amountInCents: number, currency = 'COP'): Result<Money, ValidationError> {
    if (!isNonNegativeInteger(amountInCents)) {
      return err(
        ValidationError.forField('amountInCents', 'amountInCents must be a non-negative integer'),
      );
    }
    if (!isSupportedCurrency(currency)) {
      return err(
        ValidationError.forField(
          'currency',
          `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
        ),
      );
    }
    return ok(new Money(amountInCents, currency));
  }

  static zero(currency: Currency = 'COP'): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    return new Money(this.amountInCents + other.amountInCents, this.currency);
  }

  multiply(factor: number): Result<Money, ValidationError> {
    if (!isNonNegativeInteger(factor)) {
      return err(ValidationError.forField('factor', 'factor must be a non-negative integer'));
    }
    return Money.create(this.amountInCents * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amountInCents === other.amountInCents;
  }

  toJSON(): MoneyJson {
    return { amountInCents: this.amountInCents, currency: this.currency };
  }
}
