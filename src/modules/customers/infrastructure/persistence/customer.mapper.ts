import { z } from 'zod';

import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { err, type Result } from '../../../../shared/domain/result';
import { Customer } from '../../domain/customer.entity';

const customerItemSchema = z.object({
  customerId: z.string().min(1),
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  legalIdType: z.string(),
  legalId: z.string(),
  createdAt: z.iso.datetime(),
});

const MAPPING_OPERATION = 'customers.toDomain';

export const toCustomerItem = (customer: Customer): Record<string, string> => ({
  customerId: customer.id,
  fullName: customer.fullName.value,
  email: customer.email.value,
  phone: customer.phone.value,
  legalIdType: customer.legalId.type,
  legalId: customer.legalId.number,
  createdAt: customer.createdAt.toISOString(),
});

/** Stored values go through the same rules again: an item that breaks them is corrupt data. */
export const toCustomer = (item: Record<string, unknown>): Result<Customer, PersistenceError> => {
  const parsed = customerItemSchema.safeParse(item);

  if (!parsed.success) {
    return err(new PersistenceError(MAPPING_OPERATION, parsed.error));
  }

  const { customerId, createdAt, ...data } = parsed.data;
  return Customer.create(customerId, data, new Date(createdAt)).mapErr(
    (error) => new PersistenceError(MAPPING_OPERATION, error),
  );
};
