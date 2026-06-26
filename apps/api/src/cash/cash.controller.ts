import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CashService } from './cash.service';
import { CloseSessionDto } from './dto/close-session.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { OpenSessionDto } from './dto/open-session.dto';
import { QueryRegistersDto } from './dto/query-registers.dto';
import { QuerySessionsDto } from './dto/query-sessions.dto';

@ApiTags('cash')
@ApiBearerAuth()
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Get('registers')
  @RequirePermissions('cash.view')
  findRegisters(@CurrentUser() user: JwtPayload, @Query() query: QueryRegistersDto) {
    return this.cashService.findRegisters(user.tenantId, query);
  }

  @Post('sessions/open')
  @RequirePermissions('cash.open')
  openSession(@CurrentUser() user: JwtPayload, @Body() dto: OpenSessionDto) {
    return this.cashService.openSession(user.tenantId, user.sub, dto);
  }

  @Get('sessions')
  @RequirePermissions('cash.view')
  findSessions(@CurrentUser() user: JwtPayload, @Query() query: QuerySessionsDto) {
    return this.cashService.findSessions(user.tenantId, query);
  }

  @Get('sessions/:id')
  @RequirePermissions('cash.view')
  findSession(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.cashService.findSession(user.tenantId, id);
  }

  // Contrato: `cash.manage` (o `cash.open`) — chequeo OR manual
  // porque el guard declarativo exige TODOS los permisos listados.
  @Post('sessions/:id/movements')
  addMovement(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMovementDto,
  ) {
    const granted = new Set(user.permissions ?? []);
    if (!granted.has('cash.manage') && !granted.has('cash.open')) {
      throw new ForbiddenException('Permisos faltantes: cash.manage (o cash.open)');
    }
    return this.cashService.addMovement(user.tenantId, user.sub, id, dto);
  }

  @Post('sessions/:id/close')
  @RequirePermissions('cash.close')
  closeSession(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseSessionDto,
  ) {
    return this.cashService.closeSession(user.tenantId, user.sub, id, dto);
  }
}
