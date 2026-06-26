import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateMpPaymentDto } from './dto/create-mp-payment.dto';
import { MpWebhookDto } from './dto/mp-webhook.dto';
import { PaymentsMpService } from './payments-mp.service';

@ApiTags('payments-mp')
@Controller()
export class PaymentsMpController {
  constructor(private readonly service: PaymentsMpService) {}

  @Post('orders/:id/mp-payment')
  @ApiBearerAuth()
  @RequirePermissions('sales.create')
  createPayment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMpPaymentDto,
  ) {
    return this.service.createPayment(user.tenantId, id, dto);
  }

  @Get('mp-payments/:externalId/status')
  @ApiBearerAuth()
  @RequirePermissions('sales.view')
  getStatus(@CurrentUser() user: JwtPayload, @Param('externalId') externalId: string) {
    return this.service.getStatus(user.tenantId, externalId);
  }

  @Post('webhooks/mercadopago')
  @Public()
  webhook(@Body() body: MpWebhookDto) {
    const externalId = body.externalId ?? body.data?.id ?? body.id;
    return this.service.handleWebhook(externalId);
  }
}
