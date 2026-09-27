import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';

import { ColombianPhone } from './colombian-phone.vo';
import { Email } from './email.vo';
import { FullName } from './full-name.vo';
import { LegalId } from './legal-id.vo';

/** Raw customer data as typed by the buyer (or as stored). */
export interface CustomerData {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly legalIdType: string;
  readonly legalId: string;
}

export class Customer {
  private constructor(
    readonly id: string,
    readonly fullName: FullName,
    readonly email: Email,
    readonly phone: ColombianPhone,
    readonly legalId: LegalId,
    readonly createdAt: Date,
  ) {}

  /** Validates every field at once, so the buyer sees all the errors of the form together. */
  static create(
    id: string,
    data: CustomerData,
    createdAt: Date,
  ): Result<Customer, ValidationError> {
    const fullName = FullName.create(data.fullName);
    const email = Email.create(data.email);
    const phone = ColombianPhone.create(data.phone);
    const legalId = LegalId.create(data.legalIdType, data.legalId);

    if (fullName.isOk && email.isOk && phone.isOk && legalId.isOk) {
      return ok(
        new Customer(id, fullName.value, email.value, phone.value, legalId.value, createdAt),
      );
    }

    return err(
      new ValidationError(
        [fullName, email, phone, legalId].flatMap((result) =>
          result.isErr ? result.error.fieldErrors : [],
        ),
      ),
    );
  }
}
