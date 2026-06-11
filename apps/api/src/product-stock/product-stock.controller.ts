import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AdjustProductStockDto } from './dto/adjust-product-stock.dto';
import { CreateProductionDto } from './dto/production.dto';
import { QueryProductStockDto } from './dto/query-product-stock.dto';
import { ProductStockService } from './product-stock.service';

@ApiTags('product-stock')
@ApiBearerAuth()
@Controller('product-stock')
export class ProductStockController {
  constructor(private readonly productStockService: ProductStockService) {}

  @Get()
  @RequirePermissions('stock.view')
  @ApiOperation({ summary: 'Stock de producción/platos por sucursal' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryProductStockDto) {
    return this.productStockService.findAll(user.tenantId, query);
  }

  @Post('production')
  @RequirePermissions('production.create')
  @ApiOperation({
    summary: 'Carga de producción (+N platos). Descuento de materia prima solo opcional.',
  })
  production(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductionDto) {
    return this.productStockService.createProduction(user.tenantId, user.sub, dto);
  }

  @Post('adjust')
  @RequirePermissions('stock.adjust')
  @ApiOperation({ summary: 'Ajuste manual (+/-) del stock de platos' })
  adjust(@CurrentUser() user: JwtPayload, @Body() dto: AdjustProductStockDto) {
    return this.productStockService.adjust(user.tenantId, user.sub, dto);
  }
}
