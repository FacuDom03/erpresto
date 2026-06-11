import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AdjustRawStockDto } from './dto/adjust-stock.dto';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';
import { RawMaterialsService } from './raw-materials.service';

@ApiTags('raw-materials')
@ApiBearerAuth()
@Controller('raw-materials')
export class RawMaterialsController {
  constructor(private readonly rawMaterialsService: RawMaterialsService) {}

  @Get()
  @RequirePermissions('stock.view')
  @ApiOperation({ summary: 'Lista materias primas con stock total por depósito' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.rawMaterialsService.findAll(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions('stock.view')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.rawMaterialsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions('stock.create')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRawMaterialDto) {
    return this.rawMaterialsService.create(user.tenantId, dto);
  }

  @Post(':id/adjust')
  @RequirePermissions('stock.adjust')
  @ApiOperation({ summary: 'Ajuste manual de stock en un depósito' })
  adjust(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustRawStockDto,
  ) {
    return this.rawMaterialsService.adjust(user.tenantId, user.sub, id, dto);
  }

  @Patch(':id')
  @RequirePermissions('stock.update')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRawMaterialDto,
  ) {
    return this.rawMaterialsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('stock.delete')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.rawMaterialsService.remove(user.tenantId, id);
  }
}
