import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError, type FieldError } from '../../../shared/domain/validation-error';
import { ColombianPhone } from '../../customers/domain/colombian-phone.vo';
import { FullName } from '../../customers/domain/full-name.vo';

const MIN_ADDRESS_LENGTH = 5;
const MAX_ADDRESS_LENGTH = 120;
const MAX_NOTES_LENGTH = 200;
// Colombian addresses: letters, digits, spaces and # - . , ° (e.g. "Calle 100 # 10-20").
const ADDRESS_LINE = /^[\p{L}\p{M}\d\s#.,°-]+$/u;
const DEPARTMENT_CODE = /^\d{2}$/;
const CITY_CODE = /^\d{5}$/;
const POSTAL_CODE = /^\d{6}$/;

export interface ShippingAddressData {
  readonly recipientName: string;
  readonly phone: string;
  readonly addressLine1: string;
  readonly addressLine2?: string | null;
  readonly departmentCode: string;
  readonly cityCode: string;
  readonly postalCode?: string | null;
  readonly notes?: string | null;
}

const collapse = (value: string): string => value.trim().replace(/\s+/g, ' ');
// Optional texts: an empty string means "not given".
const optional = (value?: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

const fieldError = (field: string, message: string): FieldError => ({ field, message });

export class ShippingAddress {
  private constructor(
    readonly recipientName: FullName,
    readonly phone: ColombianPhone,
    readonly addressLine1: string,
    readonly addressLine2: string | null,
    readonly departmentCode: string,
    readonly cityCode: string,
    readonly postalCode: string | null,
    readonly notes: string | null,
  ) {}

  /** Validates every field at once; field names are prefixed with `shippingAddress.`. */
  static create(data: ShippingAddressData): Result<ShippingAddress, ValidationError> {
    const recipientName = FullName.create(data.recipientName);
    const phone = ColombianPhone.create(data.phone);
    const addressLine1 = collapse(data.addressLine1);
    const addressLine2 = optional(data.addressLine2);
    const postalCode = optional(data.postalCode);
    const notes = optional(data.notes);

    const errors: FieldError[] = [
      ...(recipientName.isErr
        ? recipientName.error.fieldErrors.map(({ message }) => fieldError('recipientName', message))
        : []),
      ...(phone.isErr
        ? phone.error.fieldErrors.map(({ message }) => fieldError('phone', message))
        : []),
      ...(addressLine1.length < MIN_ADDRESS_LENGTH ||
      addressLine1.length > MAX_ADDRESS_LENGTH ||
      !ADDRESS_LINE.test(addressLine1)
        ? [
            fieldError(
              'addressLine1',
              `addressLine1 must have ${MIN_ADDRESS_LENGTH} to ${MAX_ADDRESS_LENGTH} letters, digits, spaces or # - . , °`,
            ),
          ]
        : []),
      ...(addressLine2 && addressLine2.length > MAX_ADDRESS_LENGTH
        ? [
            fieldError(
              'addressLine2',
              `addressLine2 must have at most ${MAX_ADDRESS_LENGTH} characters`,
            ),
          ]
        : []),
      ...(DEPARTMENT_CODE.test(data.departmentCode)
        ? []
        : [fieldError('departmentCode', 'departmentCode must be a 2-digit DIVIPOLA code')]),
      ...(CITY_CODE.test(data.cityCode)
        ? []
        : [fieldError('cityCode', 'cityCode must be a 5-digit DIVIPOLA code')]),
      ...(postalCode && !POSTAL_CODE.test(postalCode)
        ? [fieldError('postalCode', 'postalCode must have 6 digits')]
        : []),
      ...(notes && notes.length > MAX_NOTES_LENGTH
        ? [fieldError('notes', `notes must have at most ${MAX_NOTES_LENGTH} characters`)]
        : []),
    ].map(({ field, message }) => ({ field: `shippingAddress.${field}`, message }));

    if (errors.length > 0 || recipientName.isErr || phone.isErr) {
      return err(new ValidationError(errors));
    }
    return ok(
      new ShippingAddress(
        recipientName.value,
        phone.value,
        addressLine1,
        addressLine2,
        data.departmentCode,
        data.cityCode,
        postalCode,
        notes,
      ),
    );
  }
}
