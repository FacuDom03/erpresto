import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { QueryRecipesDto } from './dto/query-recipes.dto';
import { UpsertRecipeDto } from './dto/upsert-recipe.dto';
import { RecipesService } from './recipes.service';

@ApiTags('recipes')
@ApiBearerAuth()
@Controller()
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get('recipes')
  @RequirePermissions('costs.view')
  @ApiOperation({ summary: 'Productos del tenant con resumen de costo de receta' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryRecipesDto) {
    return this.recipesService.findAll(user.tenantId, query);
  }

  @Get('products/:id/recipe')
  @RequirePermissions('costs.view')
  @ApiOperation({ summary: 'Receta de un producto con desglose de costos' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.recipesService.findOne(user.tenantId, id);
  }

  @Put('products/:id/recipe')
  @RequirePermissions('recipes.update')
  @ApiOperation({ summary: 'Reemplaza la receta completa del producto (transaccional)' })
  upsert(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertRecipeDto,
  ) {
    return this.recipesService.upsert(user.tenantId, id, dto);
  }

  @Delete('products/:id/recipe')
  @RequirePermissions('recipes.update')
  @ApiOperation({ summary: 'Elimina la receta del producto' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.recipesService.remove(user.tenantId, id);
  }
}
