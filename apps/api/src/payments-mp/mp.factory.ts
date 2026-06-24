import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MERCADOPAGO_PROVIDER } from './mp-provider.interface';
import { MockMercadoPagoProvider } from './mock-mp.provider';
import { RealMercadoPagoProvider } from './real-mp.provider';

/**
 * Factory provider de Nest: devuelve el provider real si existe
 * MERCADOPAGO_ACCESS_TOKEN; de lo contrario, el mock por defecto.
 */
export const mpProviderFactory: Provider = {
  provide: MERCADOPAGO_PROVIDER,
  inject: [ConfigService, MockMercadoPagoProvider],
  useFactory: (config: ConfigService, mock: MockMercadoPagoProvider) => {
    const logger = new Logger('MercadoPagoFactory');
    const token = config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (token) {
      logger.log('Token Mercado Pago detectado: usando RealMercadoPagoProvider.');
      return new RealMercadoPagoProvider(token);
    }
    logger.log('Sin token Mercado Pago: usando MockMercadoPagoProvider (QR ficticio).');
    return mock;
  },
};
