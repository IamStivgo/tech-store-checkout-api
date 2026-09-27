import { unwrap } from '../../../../test/builders/unwrap';

import { LegalId } from './legal-id.vo';

const fieldErrorsOf = (type: string, number: string) => {
  const result = LegalId.create(type, number);
  return result.isErr ? result.error.fieldErrors : [];
};

describe('LegalId', () => {
  it.each([
    ['CC', '1020304050', '1020304050'],
    ['CC', '1.020.304.050', '1020304050'],
    ['CC', '12345', '12345'],
    ['CE', 'e12345', 'E12345'],
    ['NIT', '900123456', '900123456'],
    ['NIT', '900123456-7', '900123456-7'],
    ['NIT', '9001234567', '900123456-7'],
    ['NIT', '900.123.456-7', '900123456-7'],
    ['PP', 'ab1234567', 'AB1234567'],
  ])('accepts a %s %j as %j', (type, raw, expected) => {
    const legalId = unwrap(LegalId.create(type, raw));

    expect(legalId.type).toBe(type);
    expect(legalId.number).toBe(expected);
  });

  it.each([
    ['CC', '1234', 'a CC must have 5 to 10 digits'],
    ['CC', '12345678901', 'a CC must have 5 to 10 digits'],
    ['CC', 'A12345', 'a CC must have 5 to 10 digits'],
    ['CE', '12345', 'a CE must have 6 to 10 letters or digits'],
    ['NIT', '90012345', 'a NIT must have 9 digits and an optional check digit'],
    ['NIT', '900123456-78', 'a NIT must have 9 digits and an optional check digit'],
    ['PP', 'AB-12345', 'a PP must have 6 to 12 letters or digits'],
  ])('rejects a %s %j', (type, raw, message) => {
    expect(fieldErrorsOf(type, raw)).toEqual([{ field: 'legalId', message }]);
  });

  it('rejects an unknown document type', () => {
    expect(fieldErrorsOf('TI', '1020304050')).toEqual([
      { field: 'legalIdType', message: 'legalIdType must be one of CC, CE, NIT, PP' },
    ]);
  });

  it('masks all but the last four characters', () => {
    expect(unwrap(LegalId.create('CC', '1020304050')).maskedNumber()).toBe('******4050');
    expect(unwrap(LegalId.create('NIT', '900123456-7')).maskedNumber()).toBe('*******56-7');
  });
});
