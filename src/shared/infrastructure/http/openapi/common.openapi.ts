import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SUPPORTED_CURRENCIES, type Currency, type MoneyJson } from '../../../domain/money.vo';

@ApiSchema({ name: 'Money' })
export class MoneySchema implements MoneyJson {
  @ApiProperty({ description: 'Amount in cents (integer).', example: 3_990_000 })
  readonly amountInCents!: number;

  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'COP' })
  readonly currency!: Currency;
}

@ApiSchema({ name: 'ListMeta' })
export class ListMetaSchema {
  @ApiProperty({ example: 10 })
  readonly count!: number;
}
