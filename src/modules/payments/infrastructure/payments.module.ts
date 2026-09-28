import { Module } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';
import { GetAcceptanceTokens } from '../application/get-acceptance-tokens.use-case';
import { GetTokenizationKey } from '../application/get-tokenization-key.use-case';
import type { PaymentGateway } from '../domain/payment-gateway.port';

import { PaymentsController } from './http/payments.controller';
import { createPaymentGateway } from './payment-gateway.factory';
import { PAYMENT_GATEWAY } from './payment-gateway.token';

@Module({
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createPaymentGateway(config),
    },
    {
      provide: GetAcceptanceTokens,
      inject: [PAYMENT_GATEWAY],
      useFactory: (gateway: PaymentGateway) => new GetAcceptanceTokens(gateway),
    },
    {
      provide: GetTokenizationKey,
      inject: [PAYMENT_GATEWAY],
      useFactory: (gateway: PaymentGateway) => new GetTokenizationKey(gateway),
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
