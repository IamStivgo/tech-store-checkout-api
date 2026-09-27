import type { Customer } from '../domain/customer.entity';
import type { LegalIdType } from '../domain/legal-id.vo';

/** What the API returns about a customer: personal data is always masked. */
export interface CustomerView {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly legalIdType: LegalIdType;
  readonly legalId: string;
  readonly createdAt: Date;
}

export const toCustomerView = (customer: Customer): CustomerView => ({
  id: customer.id,
  fullName: customer.fullName.masked(),
  email: customer.email.masked(),
  phone: customer.phone.masked(),
  legalIdType: customer.legalId.type,
  legalId: customer.legalId.maskedNumber(),
  createdAt: customer.createdAt,
});
