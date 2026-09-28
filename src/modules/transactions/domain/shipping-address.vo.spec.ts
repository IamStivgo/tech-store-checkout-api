import { aShippingAddressData } from '../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../test/builders/unwrap';

import { ShippingAddress } from './shipping-address.vo';

const fieldsOf = (overrides: Parameters<typeof aShippingAddressData>[0]) => {
  const result = ShippingAddress.create(aShippingAddressData(overrides));
  return result.isErr ? result.error.fieldErrors.map(({ field }) => field) : [];
};

describe('ShippingAddress', () => {
  it('normalizes the recipient, phone and address', () => {
    const address = unwrap(
      ShippingAddress.create(
        aShippingAddressData({
          recipientName: '  Ana   María Gómez ',
          phone: '+57 300 123 4567',
          addressLine1: ' Calle 100  # 10-20 ',
        }),
      ),
    );

    expect(address.recipientName.value).toBe('Ana María Gómez');
    expect(address.phone.value).toBe('3001234567');
    expect(address.addressLine1).toBe('Calle 100 # 10-20');
    expect(address.postalCode).toBe('110111');
  });

  it('treats empty optional fields as not given', () => {
    const address = unwrap(
      ShippingAddress.create(
        aShippingAddressData({ addressLine2: ' ', postalCode: '', notes: null }),
      ),
    );

    expect([address.addressLine2, address.postalCode, address.notes]).toEqual([null, null, null]);
  });

  it('accepts the characters of Colombian addresses', () => {
    expect(fieldsOf({ addressLine1: 'Cra. 7 # 45-12, piso 3°' })).toEqual([]);
  });

  it('reports every invalid field with its path in the request', () => {
    expect(
      fieldsOf({
        recipientName: 'Ana',
        phone: '123',
        addressLine1: 'Cl 1',
        addressLine2: 'a'.repeat(121),
        departmentCode: '1',
        cityCode: '1100',
        postalCode: '11011',
        notes: 'a'.repeat(201),
      }),
    ).toEqual([
      'shippingAddress.recipientName',
      'shippingAddress.phone',
      'shippingAddress.addressLine1',
      'shippingAddress.addressLine2',
      'shippingAddress.departmentCode',
      'shippingAddress.cityCode',
      'shippingAddress.postalCode',
      'shippingAddress.notes',
    ]);
  });

  it.each(['Calle 100 <script>', 'a'.repeat(121)])(
    'rejects the address line %j',
    (addressLine1) => {
      expect(fieldsOf({ addressLine1 })).toEqual(['shippingAddress.addressLine1']);
    },
  );
});
