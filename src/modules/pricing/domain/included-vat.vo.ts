import { Money, type MoneyJson } from '../../../shared/domain/money.vo';
import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';

const PERCENT = 100;
const CENTS_PER_PESO = 100;
const MIN_RATE_PERCENT = 0;

export interface IncludedVatJson {
  readonly ratePercent: number;
  readonly base: MoneyJson;
  readonly amount: MoneyJson;
}

const validateRate = (ratePercent: number): Result<number, ValidationError> =>
  Number.isInteger(ratePercent) && ratePercent >= MIN_RATE_PERCENT && ratePercent <= PERCENT
    ? ok(ratePercent)
    : err(
        ValidationError.forField(
          'ratePercent',
          `ratePercent must be an integer between ${MIN_RATE_PERCENT} and ${PERCENT}`,
        ),
      );

/** VAT already included in a gross amount: only products carry it (BR-16). */
export class IncludedVat {
  private constructor(
    readonly ratePercent: number,
    readonly base: Money,
    readonly amount: Money,
  ) {}

  /** Extracts the VAT from an amount that includes it (base rounded to whole pesos). */
  static fromGross(gross: Money, ratePercent: number): Result<IncludedVat, ValidationError> {
    return validateRate(ratePercent).andThen((rate) => {
      const baseInCents = Math.round(gross.amountInCents / (PERCENT + rate)) * CENTS_PER_PESO;
      return Money.create(baseInCents, gross.currency).andThen((base) =>
        Money.create(gross.amountInCents - baseInCents, gross.currency).map(
          (amount) => new IncludedVat(rate, base, amount),
        ),
      );
    });
  }

  /** Rebuilds a stored VAT; the caller checks it still adds up to the stored product amount. */
  static create(
    ratePercent: number,
    base: Money,
    amount: Money,
  ): Result<IncludedVat, ValidationError> {
    return validateRate(ratePercent).map((rate) => new IncludedVat(rate, base, amount));
  }

  gross(): Money {
    return this.base.add(this.amount);
  }

  toJSON(): IncludedVatJson {
    return {
      ratePercent: this.ratePercent,
      base: this.base.toJSON(),
      amount: this.amount.toJSON(),
    };
  }
}
