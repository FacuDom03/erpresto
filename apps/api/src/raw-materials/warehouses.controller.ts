import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { QueryWarehousesDto } from './dto/query-warehouses.dto';
import { RawMaterialsService } from './raw-materials.service';

@ApiTags('warehouses')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly rawMaterialsService: RawMaterialsService) {}

  @Get()
  @RequirePermissions('stock.view')
  @ApiOperation({ summary: 'Lista los depósitos de una sucursal del tenant' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryWarehousesDto) {
    return this.rawMaterialsService.findWarehouses(user.tenantId, query.branchId);
  }
}
