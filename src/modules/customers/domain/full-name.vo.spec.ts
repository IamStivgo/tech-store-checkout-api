import { unwrap } from '../../../../test/builders/unwrap';

import { FullName } from './full-name.vo';

const errorOf = (raw: string) => {
  const result = FullName.create(raw);
  return result.isErr ? result.error.fieldErrors : [];
};

describe('FullName', () => {
  it.each([
    ['Ana María Gómez', 'Ana María Gómez'],
    ['  Ana   María\tGómez ', 'Ana María Gómez'],
    ["Nuño O'Neil-Peña", "Nuño O'Neil-Peña"],
    ['José A. Pérez', 'José A. Pérez'],
  ])('accepts %j as %j', (raw, expected) => {
    expect(unwrap(FullName.create(raw)).value).toBe(expected);
  });

  it.each([
    ['Al', 'fullName must have between 3 and 80 characters'],
    [`Ana ${'a'.repeat(80)}`, 'fullName must have between 3 and 80 characters'],
    ['Ana G0mez', 'fullName may only contain letters, spaces, apostrophes, hyphens and dots'],
    ['Ana <script>', 'fullName may only contain letters, spaces, apostrophes, hyphens and dots'],
    ['Madonna', 'fullName must include a first name and a last name'],
    ['Ana -', 'fullName must include a first name and a last name'],
  ])('rejects %j', (raw, message) => {
    expect(errorOf(raw)).toEqual([{ field: 'fullName', message }]);
  });

  it.each([
    ['Ana María Gómez', 'Ana M. G.'],
    ['Luis Álvarez', 'Luis Á.'],
    ["Ana O'Neil", 'Ana O.'],
    ['Ana -Luz Gómez', 'Ana L. G.'],
    ['Ana - Gómez', 'Ana G.'],
  ])('masks %j as %j', (raw, masked) => {
    expect(unwrap(FullName.create(raw)).masked()).toBe(masked);
  });
});
