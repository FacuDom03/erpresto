import { Module } from '@nestjs/common';
import { RawMaterialsController } from './raw-materials.controller';
import { RawMaterialsService } from './raw-materials.service';
import { WarehousesController } from './warehouses.controller';

@Module({
  controllers: [RawMaterialsController, WarehousesController],
  providers: [RawMaterialsService],
})
export class RawMaterialsModule {}
