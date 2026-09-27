import { unwrap } from '../../../../test/builders/unwrap';

import { Email } from './email.vo';

describe('Email', () => {
  it('trims and lowercases the address', () => {
    expect(unwrap(Email.create('  Ana.Gomez@Example.COM ')).value).toBe('ana.gomez@example.com');
  });

  it.each(['ana.gomez', 'ana@example', 'ana @example.com', 'ana@@example.com', '@example.com'])(
    'rejects %j',
    (raw) => {
      const result = Email.create(raw);

      expect(result.isErr && result.error.fieldErrors).toEqual([
        { field: 'email', message: 'email must be a valid email address' },
      ]);
    },
  );

  it('rejects addresses longer than 254 characters', () => {
    expect(Email.create(`${'a'.repeat(243)}@example.com`).isErr).toBe(true);
    expect(Email.create(`${'a'.repeat(242)}@example.com`).isOk).toBe(true);
  });

  it('masks the address keeping the first letter and the domain', () => {
    expect(unwrap(Email.create('ana.gomez@example.com')).masked()).toBe('a***@example.com');
  });
});
