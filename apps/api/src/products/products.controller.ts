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
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions('products.view')
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryProductsDto) {
    return this.productsService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('products.view')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions('products.create')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('products.update')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('products.delete')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(user.tenantId, id);
  }
}
