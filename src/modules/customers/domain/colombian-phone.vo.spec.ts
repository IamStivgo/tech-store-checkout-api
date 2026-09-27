import { unwrap } from '../../../../test/builders/unwrap';

import { ColombianPhone } from './colombian-phone.vo';

describe('ColombianPhone', () => {
  it.each([
    ['3001234567', '3001234567'],
    ['+573001234567', '3001234567'],
    ['+57 300 123 4567', '3001234567'],
    ['300-123-4567', '3001234567'],
    ['6014567890', '6014567890'],
  ])('accepts %j as %j', (raw, expected) => {
    expect(unwrap(ColombianPhone.create(raw)).value).toBe(expected);
  });

  it.each(['300123456', '30012345678', '2001234567', '6114567890', '573001234567', '300123456a'])(
    'rejects %j',
    (raw) => {
      const result = ColombianPhone.create(raw);

      expect(result.isErr && result.error.fieldErrors[0]?.field).toBe('phone');
    },
  );

  it('masks all but the last four digits', () => {
    expect(unwrap(ColombianPhone.create('3001234567')).masked()).toBe('******4567');
  });
});
