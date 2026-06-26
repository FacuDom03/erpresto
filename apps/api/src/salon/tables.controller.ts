import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateTableDto } from './dto/create-table.dto';
import { SaveLayoutDto } from './dto/layout.dto';
import { MergeTableDto } from './dto/merge-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { TablesService } from './tables.service';

@ApiTags('salon')
@ApiBearerAuth()
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  @RequirePermissions('tables.update')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTableDto) {
    return this.tablesService.create(user.tenantId, dto);
  }

  @Put('layout')
  @RequirePermissions('tables.update')
  saveLayout(@CurrentUser() user: JwtPayload, @Body() dto: SaveLayoutDto) {
    return this.tablesService.saveLayout(user.tenantId, dto);
  }

  // Layout exige `tables.update` (validado en el servicio);
  // el cambio operativo de `status` alcanza con `tables.view`.
  @Patch(':id')
  @RequirePermissions('tables.view')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tablesService.update(user.tenantId, user.permissions ?? [], id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tables.update')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tablesService.remove(user.tenantId, id);
  }

  @Post(':id/merge')
  @RequirePermissions('tables.view')
  merge(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MergeTableDto,
  ) {
    return this.tablesService.merge(user.tenantId, id, dto);
  }

  @Post(':id/split')
  @RequirePermissions('tables.view')
  split(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tablesService.split(user.tenantId, id);
  }
}
