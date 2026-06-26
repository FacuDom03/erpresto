import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Roles del tenant + roles de sistema' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.rolesService.findAll(user.tenantId);
  }

  @Post('roles')
  @RequirePermissions('roles.create')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user.tenantId, dto);
  }

  @Patch('roles/:id')
  @RequirePermissions('roles.update')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(user.tenantId, id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissions('roles.delete')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(user.tenantId, id);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Catálogo de permisos agrupado por módulo' })
  permissions() {
    return this.rolesService.permissionsCatalog();
  }
}
