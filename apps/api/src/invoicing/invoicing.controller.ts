import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateCreditNoteDto } from './dto/credit-note.dto';
import { CreateInvoiceFromOrderDto } from './dto/create-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { InvoicingService } from './invoicing.service';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicingController {
  constructor(private readonly invoicingService: InvoicingService) {}

  @Get()
  @RequirePermissions('invoices.view')
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryInvoicesDto) {
    return this.invoicingService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('invoices.view')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicingService.findOne(user.tenantId, id);
  }

  @Post('from-order/:orderId')
  @RequirePermissions('invoices.create')
  createFromOrder(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateInvoiceFromOrderDto,
  ) {
    return this.invoicingService.createFromOrder(user.tenantId, orderId, dto);
  }

  @Post(':id/credit-note')
  @RequirePermissions('invoices.create')
  createCreditNote(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCreditNoteDto,
  ) {
    return this.invoicingService.createCreditNote(user.tenantId, id, dto);
  }
}
