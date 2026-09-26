import { Money } from './money.vo';
import type { Result } from './result';
import type { ValidationError } from './validation-error';

const moneyOf = (amountInCents: number): Money =>
  Money.create(amountInCents).match({
    ok: (money) => money,
    err: () => {
      throw new Error(`Invalid test amount: ${amountInCents}`);
    },
  });

const fieldOf = (result: Result<Money, ValidationError>): string | undefined =>
  result.match({ ok: () => undefined, err: (error) => error.fieldErrors[0]?.field });

describe('Money', () => {
  it('stores whole cents in Colombian pesos by default', () => {
    expect(moneyOf(5_090_000).toJSON()).toEqual({ amountInCents: 5_090_000, currency: 'COP' });
  });

  it.each([
    ['a fraction of a cent', 100.5],
    ['a negative amount', -1],
    ['an unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ['not a number', Number.NaN],
  ])('rejects %s', (_case, amountInCents) => {
    expect(fieldOf(Money.create(amountInCents))).toBe('amountInCents');
  });

  it('rejects currencies other than COP, so amounts in different currencies cannot be mixed', () => {
    expect(fieldOf(Money.create(1_000, 'USD'))).toBe('currency');
  });

  it('adds amounts', () => {
    expect(moneyOf(3_990_000).add(moneyOf(300_000)).amountInCents).toBe(4_290_000);
  });

  it('starts from zero', () => {
    expect(Money.zero().add(moneyOf(300_000)).equals(moneyOf(300_000))).toBe(true);
  });

  it('multiplies by a whole quantity', () => {
    const total = moneyOf(3_990_000).multiply(3);

    expect(total.match({ ok: (money) => money.amountInCents, err: () => -1 })).toBe(11_970_000);
  });

  it.each([
    ['a fractional factor', 1.5],
    ['a negative factor', -2],
  ])('rejects %s', (_case, factor) => {
    expect(fieldOf(moneyOf(1_000).multiply(factor))).toBe('factor');
  });

  it('compares by amount', () => {
    expect(moneyOf(100).equals(moneyOf(100))).toBe(true);
    expect(moneyOf(100).equals(moneyOf(101))).toBe(false);
  });
});
