import type { MoneyJson } from '../../../../shared/domain/money.vo';
import type { CoverageRepository } from '../../../coverage/domain/coverage.repository.port';
import type { ZoneCode } from '../../../coverage/domain/zone-code';
import type { Delivery, DeliveryStatus } from '../../domain/delivery.entity';

export interface DeliveryResponse {
  readonly id: string;
  readonly transactionId: string;
  readonly status: DeliveryStatus;
  readonly product: { readonly id: string; readonly name: string };
  readonly quantity: number;
  readonly recipientName: string;
  readonly address: {
    readonly addressLine1: string;
    readonly cityName: string;
    readonly departmentName: string;
  };
  readonly zone: ZoneCode;
  readonly deliveryFee: MoneyJson;
  readonly estimatedDeliveryDate: string;
  readonly createdAt: string;
}

const VISIBLE_ADDRESS_CHARACTERS = 10;

// Enough to recognize the address, not to locate the buyer (api contract §5.16).
const maskAddress = (line: string): string =>
  line.length > VISIBLE_ADDRESS_CHARACTERS ? `${line.slice(0, VISIBLE_ADDRESS_CHARACTERS)}…` : line;

export const toDeliveryResponse = (
  { props }: Delivery,
  coverage: CoverageRepository,
): DeliveryResponse => {
  const { shippingAddress } = props;
  const city = coverage.findCity(shippingAddress.cityCode);
  const department = coverage
    .listDepartments()
    .find(({ code }) => code === shippingAddress.departmentCode);
  return {
    id: props.id,
    transactionId: props.transactionId,
    status: props.status,
    product: { id: props.productId, name: props.productName },
    quantity: props.quantity,
    recipientName: shippingAddress.recipientName.masked(),
    address: {
      addressLine1: maskAddress(shippingAddress.addressLine1),
      cityName: city.isOk ? city.value.name : '',
      departmentName: department?.name ?? '',
    },
    zone: props.zone,
    deliveryFee: props.deliveryFee.toJSON(),
    estimatedDeliveryDate: props.estimatedDeliveryDate,
    createdAt: props.createdAt.toISOString(),
  };
};
