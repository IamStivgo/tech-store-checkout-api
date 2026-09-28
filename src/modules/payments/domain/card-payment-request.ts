import type { Money } from '../../../shared/domain/money.vo';

export interface PaymentCustomerData {
  readonly fullName: string;
  readonly phone: string;
  readonly legalIdType: string;
  readonly legalId: string;
}

export interface PaymentShippingAddress {
  readonly recipientName: string;
  readonly phone: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string | null;
}

/** Everything the provider needs to charge a tokenized card. The signature is added by the adapter. */
export interface CardPaymentRequest {
  readonly reference: string;
  readonly amount: Money;
  readonly customerEmail: string;
  readonly cardToken: string;
  readonly installments: number;
  readonly endUserPolicyToken: string;
  readonly personalDataAuthToken: string;
  readonly customer: PaymentCustomerData;
  readonly shippingAddress: PaymentShippingAddress;
}
