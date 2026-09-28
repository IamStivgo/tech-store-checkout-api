import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { ok, ResultAsync } from '../../../../shared/domain/result';
import type { Transaction } from '../../domain/transaction.entity';
import type { TransactionRepository } from '../../domain/transaction.repository.port';

import { toTransaction } from './transaction.mapper';

export class DynamoDbTransactionRepository implements TransactionRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  findById(id: string): ResultAsync<Transaction | null, PersistenceError> {
    return ResultAsync.fromPromise(
      // Buyers read their transaction right after creating or paying it.
      this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { transactionId: id },
          ConsistentRead: true,
        }),
      ),
      (cause) => new PersistenceError('transactions.findById', cause),
    ).andThen(({ Item }) => (Item ? toTransaction(Item) : ok(null)));
  }
}
