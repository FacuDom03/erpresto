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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions('customers.view')
  @ApiOperation({ summary: 'Lista clientes (search por nombre/teléfono/email)' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryCustomersDto) {
    return this.customersService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('customers.view')
  @ApiOperation({ summary: 'Detalle con stats (pedidos CLOSED)' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions('customers.create')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('customers.update')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('customers.delete')
  @ApiOperation({ summary: 'Soft delete si tiene pedidos/reservas, hard delete si no' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.remove(user.tenantId, id);
  }
}
