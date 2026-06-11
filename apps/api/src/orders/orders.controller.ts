import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AddItemsDto } from './dto/add-items.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderItemDto } from './dto/update-item.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePermissions('sales.create')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.tenantId, user.sub, dto);
  }

  @Get()
  @RequirePermissions('sales.view')
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('sales.view')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('sales.update')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(user.tenantId, id, dto);
  }

  @Post(':id/items')
  @RequirePermissions('sales.create')
  addItems(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddItemsDto,
  ) {
    return this.ordersService.addItems(user.tenantId, id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('sales.create')
  updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateOrderItemDto,
  ) {
    return this.ordersService.updateItem(user.tenantId, user.permissions ?? [], id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions('sales.create')
  removeItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.ordersService.removeItem(user.tenantId, id, itemId);
  }

  @Post(':id/send')
  @RequirePermissions('sales.create')
  send(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.send(user.tenantId, id);
  }

  @Post(':id/payments')
  @RequirePermissions('sales.create')
  addPayment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPaymentDto,
  ) {
    return this.ordersService.addPayment(user.tenantId, id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @RequirePermissions('sales.update')
  removePayment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.ordersService.removePayment(user.tenantId, id, paymentId);
  }

  @Post(':id/close')
  @RequirePermissions('sales.create')
  close(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.close(user.tenantId, user.sub, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('sales.cancel')
  cancel(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.cancel(user.tenantId, user.sub, id);
  }
}
