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
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryUsersDto) {
    // El listado general requiere users.view; el filtro por rol (ej. para
    // armar el desplegable de repartidores) se habilita también con
    // sales.view, sin inflar el RBAC con un permiso nuevo.
    const granted = new Set(user.permissions ?? []);
    if (!granted.has('users.view') && !(query.role && granted.has('sales.view'))) {
      throw new ForbiddenException('Permisos faltantes: users.view');
    }
    return this.usersService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('users.view')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions('users.create')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.tenantId, dto);
  }

  @Patch(':id/roles')
  @RequirePermissions('users.update')
  assignRoles(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRolesDto,
  ) {
    return this.usersService.assignRoles(user.tenantId, id, dto);
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users.delete')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(user.tenantId, id);
  }
}
