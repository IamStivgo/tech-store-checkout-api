import type { Money } from '../../../shared/domain/money.vo';
import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';
import type { BusinessDaysRange } from '../../coverage/domain/delivery-zone.vo';
import type { ZoneCode } from '../../coverage/domain/zone-code';

import type { ShippingAddress } from './shipping-address.vo';
import { isFinalStatus, type TransactionStatus } from './transaction-status';
import { TransactionNotCancellableError } from './transaction.errors';

/** Product data frozen at purchase time: later catalog changes never alter the order. */
export interface ProductSnapshot {
  readonly sku: string;
  readonly name: string;
  readonly unitPrice: Money;
  readonly weightGrams: number;
}

export interface TransactionAmounts {
  readonly productAmount: Money;
  readonly serviceFee: Money;
  readonly deliveryFee: Money;
  readonly total: Money;
}

export interface TransactionDelivery {
  readonly zone: ZoneCode;
  readonly billableWeightKg: number;
  readonly estimatedBusinessDays: BusinessDaysRange;
}

/** The payment sent to the provider; it exists from the moment the payment is claimed. */
export interface TransactionPayment {
  readonly attemptId: string;
  readonly submittedAt: Date;
  readonly installments: number;
  readonly providerTransactionId: string | null;
  readonly providerStatus: string | null;
  readonly statusMessage: string | null;
  readonly cardBrand: string | null;
  readonly cardLastFour: string | null;
}

export interface TransactionProps {
  readonly id: string;
  readonly reference: string;
  readonly status: TransactionStatus;
  readonly productId: string;
  readonly customerId: string;
  readonly product: ProductSnapshot;
  readonly quantity: number;
  readonly shippingAddress: ShippingAddress;
  readonly amounts: TransactionAmounts;
  readonly delivery: TransactionDelivery;
  readonly payment: TransactionPayment | null;
  readonly deliveryId: string | null;
  readonly reservationExpiresAt: Date;
  readonly finalizedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewTransactionProps = Omit<
  TransactionProps,
  'status' | 'payment' | 'deliveryId' | 'finalizedAt' | 'updatedAt' | 'reservationExpiresAt'
>;

const MS_PER_MINUTE = 60_000;

const addsUp = ({ productAmount, serviceFee, deliveryFee, total }: TransactionAmounts): boolean =>
  productAmount.add(serviceFee).add(deliveryFee).equals(total);

export class Transaction {
  private constructor(private readonly props: TransactionProps) {}

  /** A new PENDING order whose stock stays reserved for `reservationTtlMinutes` (BR-08). */
  static create(
    props: NewTransactionProps,
    reservationTtlMinutes: number,
  ): Result<Transaction, ValidationError> {
    if (!Number.isSafeInteger(props.quantity) || props.quantity < 1) {
      return err(ValidationError.forField('quantity', 'quantity must be a positive integer'));
    }
    if (!addsUp(props.amounts)) {
      return err(ValidationError.forField('amounts', 'total must be the sum of the charges'));
    }
    return ok(
      new Transaction({
        ...props,
        status: 'PENDING',
        payment: null,
        deliveryId: null,
        finalizedAt: null,
        updatedAt: props.createdAt,
        reservationExpiresAt: new Date(
          props.createdAt.getTime() + reservationTtlMinutes * MS_PER_MINUTE,
        ),
      }),
    );
  }

  /** Rebuilds a stored transaction; its invariants were checked when it was created. */
  static restore(props: TransactionProps): Transaction {
    return new Transaction(props);
  }

  get id(): string {
    return this.props.id;
  }

  get reference(): string {
    return this.props.reference;
  }

  get status(): TransactionStatus {
    return this.props.status;
  }

  get productId(): string {
    return this.props.productId;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get product(): ProductSnapshot {
    return this.props.product;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get shippingAddress(): ShippingAddress {
    return this.props.shippingAddress;
  }

  get amounts(): TransactionAmounts {
    return this.props.amounts;
  }

  get delivery(): TransactionDelivery {
    return this.props.delivery;
  }

  get payment(): TransactionPayment | null {
    return this.props.payment;
  }

  get deliveryId(): string | null {
    return this.props.deliveryId;
  }

  get reservationExpiresAt(): Date {
    return this.props.reservationExpiresAt;
  }

  get finalizedAt(): Date | null {
    return this.props.finalizedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isFinal(): boolean {
    return isFinalStatus(this.props.status);
  }

  /** The buyer gives up before paying: only a PENDING order without a sent payment. */
  cancel(now: Date): Result<Transaction, TransactionNotCancellableError> {
    if (this.props.status !== 'PENDING' || this.props.payment) {
      return err(new TransactionNotCancellableError(this.props.status));
    }
    return ok(
      new Transaction({ ...this.props, status: 'CANCELLED', finalizedAt: now, updatedAt: now }),
    );
  }
}
