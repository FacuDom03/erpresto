import {
  Body,
  Controller,
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
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';
import { SeatReservationDto } from './dto/seat-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @RequirePermissions('reservations.view')
  @ApiOperation({ summary: 'Lista reservas por rango de scheduledAt (default: hoy)' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryReservationsDto) {
    return this.reservationsService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('reservations.view')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions('reservations.create')
  @ApiOperation({ summary: 'Crea reserva (bloqueo automático de mesa si está dentro de 2 h)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReservationDto) {
    return this.reservationsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('reservations.update')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(user.tenantId, id, dto);
  }

  @Post(':id/seat')
  @RequirePermissions('reservations.update')
  @ApiOperation({ summary: 'Sentar: reserva → SEATED y mesa → OCCUPIED (409 si ocupada)' })
  seat(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SeatReservationDto,
  ) {
    return this.reservationsService.seat(user.tenantId, id, dto);
  }
}
