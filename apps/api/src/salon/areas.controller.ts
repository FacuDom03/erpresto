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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { QueryAreasDto } from './dto/query-areas.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@ApiTags('salon')
@ApiBearerAuth()
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  @RequirePermissions('tables.view')
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryAreasDto) {
    return this.areasService.findAll(user.tenantId, query);
  }

  @Post()
  @RequirePermissions('tables.update')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAreaDto) {
    return this.areasService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('tables.update')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAreaDto,
  ) {
    return this.areasService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tables.update')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.areasService.remove(user.tenantId, id);
  }
}
