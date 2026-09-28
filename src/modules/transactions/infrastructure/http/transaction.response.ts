import type { MoneyJson } from '../../../../shared/domain/money.vo';
import type { BusinessDaysRange } from '../../../coverage/domain/delivery-zone.vo';
import type { ZoneCode } from '../../../coverage/domain/zone-code';
import type { TransactionStatus } from '../../domain/transaction-status';
import type { Transaction } from '../../domain/transaction.entity';

export interface TransactionPaymentResponse {
  readonly status: string | null;
  readonly statusMessage: string | null;
  readonly method: 'CARD';
  readonly cardBrand: string | null;
  readonly cardLastFour: string | null;
  readonly installments: number;
  readonly submittedAt: string;
}

/** The buyer's view of a transaction: no personal data, card data or provider tokens. */
export interface TransactionResponse {
  readonly id: string;
  readonly reference: string;
  readonly status: TransactionStatus;
  readonly product: { readonly id: string; readonly sku: string; readonly name: string };
  readonly quantity: number;
  readonly amounts: {
    readonly productAmount: MoneyJson;
    readonly serviceFee: MoneyJson;
    readonly deliveryFee: MoneyJson;
    readonly total: MoneyJson;
  };
  readonly delivery: { readonly zone: ZoneCode; readonly estimatedBusinessDays: BusinessDaysRange };
  readonly payment: TransactionPaymentResponse | null;
  readonly deliveryId: string | null;
  readonly reservationExpiresAt: string;
  readonly finalizedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const toTransactionResponse = (transaction: Transaction): TransactionResponse => {
  const { amounts, payment } = transaction;
  return {
    id: transaction.id,
    reference: transaction.reference,
    status: transaction.status,
    product: {
      id: transaction.productId,
      sku: transaction.product.sku,
      name: transaction.product.name,
    },
    quantity: transaction.quantity,
    amounts: {
      productAmount: amounts.productAmount.toJSON(),
      serviceFee: amounts.serviceFee.toJSON(),
      deliveryFee: amounts.deliveryFee.toJSON(),
      total: amounts.total.toJSON(),
    },
    delivery: {
      zone: transaction.delivery.zone,
      estimatedBusinessDays: transaction.delivery.estimatedBusinessDays,
    },
    payment: payment
      ? {
          status: payment.providerStatus,
          statusMessage: payment.statusMessage,
          method: 'CARD',
          cardBrand: payment.cardBrand,
          cardLastFour: payment.cardLastFour,
          installments: payment.installments,
          submittedAt: payment.submittedAt.toISOString(),
        }
      : null,
    deliveryId: transaction.deliveryId,
    reservationExpiresAt: transaction.reservationExpiresAt.toISOString(),
    finalizedAt: transaction.finalizedAt?.toISOString() ?? null,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
};
