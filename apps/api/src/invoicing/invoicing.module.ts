import { Module } from '@nestjs/common';
import { arcaProviderFactory } from './arca/arca.factory';
import { MockArcaProvider } from './arca/mock-arca.provider';
import { InvoicingController } from './invoicing.controller';
import { InvoicingService } from './invoicing.service';

@Module({
  controllers: [InvoicingController],
  providers: [InvoicingService, MockArcaProvider, arcaProviderFactory],
})
export class InvoicingModule {}
