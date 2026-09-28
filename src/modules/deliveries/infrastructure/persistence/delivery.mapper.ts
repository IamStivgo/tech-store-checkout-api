import { z } from 'zod';

import { Money } from '../../../../shared/domain/money.vo';
import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { err, type Result } from '../../../../shared/domain/result';
import { ZONE_CODES } from '../../../coverage/domain/zone-code';
import { ShippingAddress } from '../../../transactions/domain/shipping-address.vo';
import { Delivery } from '../../domain/delivery.entity';

const MAPPING_OPERATION = 'deliveries.toDomain';

const itemSchema = z.object({
  deliveryId: z.string().min(1),
  transactionId: z.string().min(1),
  customerId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string(),
  quantity: z.number().int(),
  shippingAddress: z.object({
    recipientName: z.string(),
    phone: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string().nullish(),
    departmentCode: z.string(),
    cityCode: z.string(),
    postalCode: z.string().nullish(),
    notes: z.string().nullish(),
  }),
  zoneCode: z.enum(ZONE_CODES),
  deliveryFeeInCents: z.number().int(),
  currency: z.string(),
  status: z.literal('ASSIGNED'),
  estimatedDeliveryDate: z.string(),
  createdAt: z.iso.datetime(),
});

/** Stored values go through the domain rules again: an item that breaks them is corrupt data. */
export const toDelivery = (raw: Record<string, unknown>): Result<Delivery, PersistenceError> => {
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return err(new PersistenceError(MAPPING_OPERATION, parsed.error));
  }
  const item = parsed.data;
  return ShippingAddress.create(item.shippingAddress)
    .andThen((shippingAddress) =>
      Money.create(item.deliveryFeeInCents, item.currency).map((deliveryFee) =>
        Delivery.restore({
          id: item.deliveryId,
          transactionId: item.transactionId,
          customerId: item.customerId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          shippingAddress,
          zone: item.zoneCode,
          deliveryFee,
          status: item.status,
          estimatedDeliveryDate: item.estimatedDeliveryDate,
          createdAt: new Date(item.createdAt),
        }),
      ),
    )
    .mapErr((cause) => new PersistenceError(MAPPING_OPERATION, cause));
};

export const toDeliveryItem = ({ props }: Delivery): Record<string, unknown> => ({
  deliveryId: props.id,
  transactionId: props.transactionId,
  customerId: props.customerId,
  productId: props.productId,
  productName: props.productName,
  quantity: props.quantity,
  shippingAddress: {
    recipientName: props.shippingAddress.recipientName.value,
    phone: props.shippingAddress.phone.value,
    addressLine1: props.shippingAddress.addressLine1,
    addressLine2: props.shippingAddress.addressLine2 ?? undefined,
    departmentCode: props.shippingAddress.departmentCode,
    cityCode: props.shippingAddress.cityCode,
    postalCode: props.shippingAddress.postalCode ?? undefined,
    notes: props.shippingAddress.notes ?? undefined,
  },
  zoneCode: props.zone,
  deliveryFeeInCents: props.deliveryFee.amountInCents,
  currency: props.deliveryFee.currency,
  status: props.status,
  estimatedDeliveryDate: props.estimatedDeliveryDate,
  createdAt: props.createdAt.toISOString(),
  updatedAt: props.createdAt.toISOString(),
});
