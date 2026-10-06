import { Money } from '../../../shared/domain/money.vo';
import type { Result } from '../../../shared/domain/result';
import type { ValidationError } from '../../../shared/domain/validation-error';

import { IncludedVat } from './included-vat.vo';

const VAT_RATE_PERCENT = 19;

const moneyOf = (amountInCents: number): Money =>
  Money.create(amountInCents).match({
    ok: (money) => money,
    err: () => {
      throw new Error(`Invalid test amount: ${amountInCents}`);
    },
  });

const vatOf = (result: Result<IncludedVat, ValidationError>): IncludedVat =>
  result.match({
    ok: (vat) => vat,
    err: () => {
      throw new Error('Expected a valid VAT');
    },
  });

const fieldOf = (result: Result<IncludedVat, ValidationError>): string | undefined =>
  result.match({ ok: () => undefined, err: (error) => error.fieldErrors[0]?.field });

describe('IncludedVat', () => {
  it.each([
    ['1 x USB-C cable', 3_990_000, 3_352_900, 637_100],
    ['1 x ergonomic mouse', 11_990_000, 10_075_600, 1_914_400],
    [
      '2 x ergonomic mouse (extracted from the line, not per unit)',
      23_980_000,
      20_151_300,
      3_828_700,
    ],
    ['1 x 7-in-1 USB-C hub', 14_990_000, 12_596_600, 2_393_400],
  ])('extracts the VAT of %s', (_case, gross, base, amount) => {
    const vat = vatOf(IncludedVat.fromGross(moneyOf(gross), VAT_RATE_PERCENT));

    expect(vat.toJSON()).toEqual({
      ratePercent: VAT_RATE_PERCENT,
      base: { amountInCents: base, currency: 'COP' },
      amount: { amountInCents: amount, currency: 'COP' },
    });
  });

  it.each([1_990_000, 3_990_001, 11_990_000, 23_980_000, 99_999_900])(
    'always adds up to the gross amount (%i)',
    (gross) => {
      const vat = vatOf(IncludedVat.fromGross(moneyOf(gross), VAT_RATE_PERCENT));

      expect(vat.gross().amountInCents).toBe(gross);
    },
  );

  it('has no VAT when the amount is zero', () => {
    const vat = vatOf(IncludedVat.fromGross(Money.zero(), VAT_RATE_PERCENT));

    expect(vat.base.amountInCents).toBe(0);
    expect(vat.amount.amountInCents).toBe(0);
  });

  it('has no VAT when the rate is zero', () => {
    const vat = vatOf(IncludedVat.fromGross(moneyOf(3_990_000), 0));

    expect(vat.base.amountInCents).toBe(3_990_000);
    expect(vat.amount.amountInCents).toBe(0);
  });

  it.each([
    ['negative', -1],
    ['above 100', 101],
    ['a decimal', 19.5],
    ['not a number', Number.NaN],
  ])('rejects a rate that is %s', (_case, ratePercent) => {
    expect(fieldOf(IncludedVat.fromGross(moneyOf(3_990_000), ratePercent))).toBe('ratePercent');
    expect(fieldOf(IncludedVat.create(ratePercent, moneyOf(1), moneyOf(1)))).toBe('ratePercent');
  });

  it('rebuilds a stored VAT', () => {
    const vat = vatOf(IncludedVat.create(VAT_RATE_PERCENT, moneyOf(3_352_900), moneyOf(637_100)));

    expect(vat.gross().amountInCents).toBe(3_990_000);
  });

  it('exposes a rebuilt VAT that does not add up so the caller can reject it', () => {
    const vat = vatOf(IncludedVat.create(VAT_RATE_PERCENT, moneyOf(3_352_900), moneyOf(1)));

    expect(vat.gross().equals(moneyOf(3_990_000))).toBe(false);
  });
});
