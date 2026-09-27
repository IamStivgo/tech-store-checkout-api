import type { CustomerView } from '../../application/customer.views';
import type { LegalIdType } from '../../domain/legal-id.vo';

/** Masked customer, as returned by POST /customers and GET /customers/{id}. */
export interface CustomerResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly legalIdType: LegalIdType;
  readonly legalId: string;
  readonly createdAt: string;
}

export const toCustomerResponse = (view: CustomerView): CustomerResponse => ({
  ...view,
  createdAt: view.createdAt.toISOString(),
});
