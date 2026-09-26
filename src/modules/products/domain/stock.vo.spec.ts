import { aStock } from '../../../../test/builders/product.builder';

import { Stock } from './stock.vo';

const LOW_STOCK_THRESHOLD = 3;

describe('Stock', () => {
  it.each([
    [0, 'OUT_OF_STOCK'],
    [1, 'LOW_STOCK'],
    [3, 'LOW_STOCK'],
    [4, 'IN_STOCK'],
  ])('with %i available units is %s', (available, status) => {
    expect(aStock({ available }).statusFor(LOW_STOCK_THRESHOLD)).toBe(status);
  });

  it('keeps the three counters', () => {
    expect(aStock({ available: 24, reserved: 2, sold: 4 })).toMatchObject({
      available: 24,
      reserved: 2,
      sold: 4,
    });
  });

  it.each([
    ['available', { available: -1, reserved: 0, sold: 0 }],
    ['reserved', { available: 1, reserved: 0.5, sold: 0 }],
    ['sold', { available: 1, reserved: 0, sold: Number.NaN }],
  ])('rejects an invalid %s counter', (counter, counters) => {
    const field = Stock.create(counters).match({
      ok: () => undefined,
      err: (error) => error.fieldErrors[0]?.field,
    });

    expect(field).toBe(`stock.${counter}`);
  });
});
