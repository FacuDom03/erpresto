import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('purchases.view')
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryPurchaseOrdersDto) {
    return this.purchaseOrdersService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('purchases.view')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions('purchases.create')
  @ApiOperation({ summary: 'Crea una OC en DRAFT con numeración correlativa por tenant' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(user.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions('purchases.update')
  @ApiOperation({ summary: 'Edita una OC en DRAFT (items reemplaza todo)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(user.tenantId, id, dto);
  }

  @Post(':id/send')
  @RequirePermissions('purchases.update')
  send(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.send(user.tenantId, id);
  }

  @Post(':id/receive')
  @RequirePermissions('purchases.receive')
  @ApiOperation({
    summary:
      'Recepción parcial o total: StockBatch + movimiento PURCHASE + lastCost/avgCost ponderado',
  })
  receive(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.receive(user.tenantId, user.sub, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('purchases.update')
  cancel(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.cancel(user.tenantId, id);
  }
}
