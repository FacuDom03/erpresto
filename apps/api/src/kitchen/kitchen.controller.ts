import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { QueryKitchenItemsDto } from './dto/query-kitchen-items.dto';
import { UpdateKitchenItemStatusDto } from './dto/update-item-status.dto';
import { KitchenService } from './kitchen.service';

@ApiTags('kitchen')
@ApiBearerAuth()
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('items')
  @RequirePermissions('kitchen.view')
  findItems(@CurrentUser() user: JwtPayload, @Query() query: QueryKitchenItemsDto) {
    return this.kitchenService.findItems(user.tenantId, query);
  }

  @Patch('items/:id/status')
  @RequirePermissions('kitchen.update')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKitchenItemStatusDto,
  ) {
    return this.kitchenService.updateStatus(user.tenantId, user.permissions ?? [], id, dto);
  }
}
