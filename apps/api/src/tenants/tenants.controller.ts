import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Datos del tenant actual (settings + stockMode)' })
  me(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.me(user.tenantId);
  }

  @Patch('me')
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Actualiza nombre, settings y modo de stock' })
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(user.tenantId, dto);
  }
}
