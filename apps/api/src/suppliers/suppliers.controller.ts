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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers.view')
  @ApiOperation({ summary: 'Lista proveedores del tenant (search por nombre/CUIT)' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QuerySuppliersDto) {
    return this.suppliersService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('suppliers.view')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions('suppliers.create')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('suppliers.update')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('suppliers.delete')
  @ApiOperation({ summary: 'Soft delete si tiene órdenes de compra, hard delete si no' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.remove(user.tenantId, id);
  }
}
