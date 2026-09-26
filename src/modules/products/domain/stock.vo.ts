import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';

import type { StockStatus } from './stock-status';

export interface StockCounters {
  readonly available: number;
  readonly reserved: number;
  readonly sold: number;
}

const isCounter = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

export class Stock {
  private constructor(
    readonly available: number,
    readonly reserved: number,
    readonly sold: number,
  ) {}

  static create({ available, reserved, sold }: StockCounters): Result<Stock, ValidationError> {
    const invalid = Object.entries({ available, reserved, sold }).find(
      ([, value]) => !isCounter(value),
    );

    if (invalid) {
      const [counter] = invalid;
      return err(
        ValidationError.forField(`stock.${counter}`, `${counter} must be a non-negative integer`),
      );
    }
    return ok(new Stock(available, reserved, sold));
  }

  statusFor(lowStockThreshold: number): StockStatus {
    if (this.available === 0) {
      return 'OUT_OF_STOCK';
    }
    return this.available <= lowStockThreshold ? 'LOW_STOCK' : 'IN_STOCK';
  }
}
