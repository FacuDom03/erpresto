import { Module } from '@nestjs/common';
import { StationsController } from './stations.controller';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController, StationsController],
  providers: [TenantsService],
})
export class TenantsModule {}
