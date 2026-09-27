import { Module } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';
import type { Clock } from '../../../shared/domain/clock.port';
import { Money } from '../../../shared/domain/money.vo';
import { CLOCK } from '../../../shared/infrastructure/system/clock.token';
import type { CoverageRepository } from '../../coverage/domain/coverage.repository.port';
import { COVERAGE_REPOSITORY } from '../../coverage/infrastructure/coverage-repository.token';
import { CoverageModule } from '../../coverage/infrastructure/coverage.module';
import { JsonCoverageRepository } from '../../coverage/infrastructure/json-coverage.repository';
import type { ProductRepository } from '../../products/domain/product.repository.port';
import { PRODUCT_REPOSITORY } from '../../products/infrastructure/product-repository.token';
import { ProductsModule } from '../../products/infrastructure/products.module';
import { QuoteCheckout } from '../application/quote-checkout.use-case';
import { CheckoutPricingService } from '../domain/checkout-pricing.service';
import { DeliveryFeeCalculator } from '../domain/delivery-fee.calculator';
import type { PricingPolicy } from '../domain/pricing-policy';

import { CheckoutController } from './http/checkout.controller';

const toMoney = (amountInCents: number): Money =>
  Money.create(amountInCents).match({
    ok: (money) => money,
    err: () => {
      throw new Error(`Invalid pricing configuration amount: ${amountInCents}`);
    },
  });

@Module({
  imports: [ProductsModule, CoverageModule],
  controllers: [CheckoutController],
  providers: [
    {
      provide: CheckoutPricingService,
      inject: [APP_CONFIG, JsonCoverageRepository],
      useFactory: (config: AppConfig, coverage: JsonCoverageRepository) => {
        const policy: PricingPolicy = {
          serviceFee: toMoney(config.pricing.serviceFeeInCents),
          freeShippingThreshold: toMoney(config.pricing.freeShippingThresholdInCents),
          includedWeightKg: coverage.includedWeightKg,
        };
        return new CheckoutPricingService(policy, new DeliveryFeeCalculator(policy));
      },
    },
    {
      provide: QuoteCheckout,
      inject: [PRODUCT_REPOSITORY, COVERAGE_REPOSITORY, CheckoutPricingService, APP_CONFIG, CLOCK],
      useFactory: (
        products: ProductRepository,
        coverage: CoverageRepository,
        pricing: CheckoutPricingService,
        config: AppConfig,
        clock: Clock,
      ) => new QuoteCheckout(products, coverage, pricing, config.catalog, clock),
    },
  ],
})
export class PricingModule {}
