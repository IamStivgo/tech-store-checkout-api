import type { Delivery } from '../../domain/delivery.entity';

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
