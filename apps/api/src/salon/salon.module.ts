import { Module } from '@nestjs/common';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';

@Module({
  controllers: [AreasController, TablesController],
  providers: [AreasService, TablesService],
  exports: [TablesService],
})
export class SalonModule {}
