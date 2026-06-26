import { Module } from '@nestjs/common';
import { mpProviderFactory } from './mp.factory';
import { MockMercadoPagoProvider } from './mock-mp.provider';
import { PaymentsMpController } from './payments-mp.controller';
import { PaymentsMpService } from './payments-mp.service';

@Module({
  controllers: [PaymentsMpController],
  providers: [PaymentsMpService, MockMercadoPagoProvider, mpProviderFactory],
})
export class PaymentsMpModule {}
