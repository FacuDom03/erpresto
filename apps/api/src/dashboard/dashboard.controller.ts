import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermissions('dashboard.view')
  @ApiOperation({
    summary: 'Resumen del día (TZ de la sucursal). Sin branchId: consolidado del tenant',
  })
  summary(@CurrentUser() user: JwtPayload, @Query() query: QueryDashboardDto) {
    return this.dashboardService.summary(user.tenantId, query.branchId);
  }
}
