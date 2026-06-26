import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateStationsDto } from './dto/update-stations.dto';
import { TenantsService } from './tenants.service';

@ApiTags('stations')
@ApiBearerAuth()
@Controller('stations')
export class StationsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({ summary: 'Catálogo de estaciones del tenant actual' })
  list(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.getStations(user.tenantId);
  }

  @Put()
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Reemplaza el catálogo de estaciones del tenant' })
  set(@CurrentUser() user: JwtPayload, @Body() dto: UpdateStationsDto) {
    return this.tenantsService.setStations(user.tenantId, dto);
  }
}
