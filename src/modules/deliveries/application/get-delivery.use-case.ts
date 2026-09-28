import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { errAsync, okAsync, type ResultAsync } from '../../../shared/domain/result';
import { findTransaction } from '../../transactions/application/find-transaction';
import type { TransactionNotFoundError } from '../../transactions/domain/transaction.errors';
import type { TransactionRepository } from '../../transactions/domain/transaction.repository.port';
import type { Delivery } from '../domain/delivery.entity';
import { DeliveryNotFoundError } from '../domain/delivery.errors';
import type { DeliveryRepository } from '../domain/delivery.repository.port';

export class GetDelivery {
  constructor(private readonly deliveries: DeliveryRepository) {}

  execute(id: string): ResultAsync<Delivery, DeliveryNotFoundError | PersistenceError> {
    return this.deliveries
      .findById(id)
      .andThen((delivery) =>
        delivery ? okAsync(delivery) : errAsync(new DeliveryNotFoundError()),
      );
  }
}

/** The delivery of a transaction: only an APPROVED transaction has one (RF-15). */
export class GetDeliveryByTransaction {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly getDelivery: GetDelivery,
  ) {}

  execute(
    transactionId: string,
  ): ResultAsync<Delivery, TransactionNotFoundError | DeliveryNotFoundError | PersistenceError> {
    return findTransaction(this.transactions, transactionId).andThen(({ deliveryId }) =>
      deliveryId ? this.getDelivery.execute(deliveryId) : errAsync(new DeliveryNotFoundError()),
    );
  }
}
