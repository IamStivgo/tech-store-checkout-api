import type { Money } from '../../../shared/domain/money.vo';
import type { ZoneCode } from '../../coverage/domain/zone-code';
import type { ShippingAddress } from '../../transactions/domain/shipping-address.vo';
import type { Transaction } from '../../transactions/domain/transaction.entity';

import { estimatedDeliveryDate } from './estimated-delivery-date';

export type DeliveryStatus = 'ASSIGNED';

export interface DeliveryProps {
  readonly id: string;
  readonly transactionId: string;
  readonly customerId: string;
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly shippingAddress: ShippingAddress;
  readonly zone: ZoneCode;
  readonly deliveryFee: Money;
  readonly status: DeliveryStatus;
  /** `YYYY-MM-DD`. */
  readonly estimatedDeliveryDate: string;
  readonly createdAt: Date;
}

/** The shipment of an approved transaction, assigned when the payment is approved (RF-15). */
export class Delivery {
  private constructor(readonly props: DeliveryProps) {}

  /** Promises the latest day of the zone's range, counted from the approval. */
  static assignFor(transaction: Transaction, id: string, now: Date): Delivery {
    return new Delivery({
      id,
      transactionId: transaction.id,
      customerId: transaction.customerId,
      productId: transaction.productId,
      productName: transaction.product.name,
      quantity: transaction.quantity,
      shippingAddress: transaction.shippingAddress,
      zone: transaction.delivery.zone,
      deliveryFee: transaction.amounts.deliveryFee,
      status: 'ASSIGNED',
      estimatedDeliveryDate: estimatedDeliveryDate(
        now,
        transaction.delivery.estimatedBusinessDays.max,
      ),
      createdAt: now,
    });
  }

  static restore(props: DeliveryProps): Delivery {
    return new Delivery(props);
  }

  get id(): string {
    return this.props.id;
  }
}
