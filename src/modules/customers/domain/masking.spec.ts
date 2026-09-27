import { maskAllButLastFour } from './masking';

describe('maskAllButLastFour', () => {
  it.each([
    ['3001234567', '******4567'],
    ['12345', '*2345'],
    ['1234', '1234'],
    ['123', '123'],
  ])('masks %j as %j', (value, masked) => {
    expect(maskAllButLastFour(value)).toBe(masked);
  });
});
