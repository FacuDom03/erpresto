import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { DeliveryService } from './delivery.service';
import { AssignCourierDto } from './dto/assign-courier.dto';
import { QueryDeliveriesDto } from './dto/query-deliveries.dto';
import { UpdateDeliveryStatusDto } from './dto/update-status.dto';
import { UpsertDeliveryDto } from './dto/upsert-delivery.dto';

@ApiTags('delivery')
@ApiBearerAuth()
@Controller()
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Put('orders/:id/delivery')
  @RequirePermissions('sales.create')
  upsert(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertDeliveryDto,
  ) {
    return this.service.upsert(user.tenantId, id, dto);
  }

  @Get('deliveries')
  @RequirePermissions('sales.view')
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryDeliveriesDto) {
    return this.service.findAll(user.tenantId, query);
  }

  @Post('deliveries/:id/assign')
  @RequirePermissions('sales.update')
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCourierDto,
  ) {
    return this.service.assign(user.tenantId, id, dto);
  }

  @Patch('deliveries/:id/status')
  @RequirePermissions('sales.update')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.service.updateStatus(user.tenantId, id, dto);
  }
}
