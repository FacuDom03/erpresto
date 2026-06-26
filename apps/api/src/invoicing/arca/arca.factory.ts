import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ARCA_PROVIDER } from './arca-provider.interface';
import { MockArcaProvider } from './mock-arca.provider';
import { WsfeArcaProvider } from './wsfe-arca.provider';

/**
 * Factory provider de Nest: devuelve el provider real (WSFE) si están
 * configuradas TODAS las credenciales (ARCA_CUIT, ARCA_CERT_PATH,
 * ARCA_KEY_PATH); de lo contrario, el mock por defecto.
 */
export const arcaProviderFactory: Provider = {
  provide: ARCA_PROVIDER,
  inject: [ConfigService, MockArcaProvider],
  useFactory: (config: ConfigService, mock: MockArcaProvider) => {
    const logger = new Logger('ArcaFactory');
    const cuit = config.get<string>('ARCA_CUIT');
    const certPath = config.get<string>('ARCA_CERT_PATH');
    const keyPath = config.get<string>('ARCA_KEY_PATH');

    if (cuit && certPath && keyPath) {
      logger.log('Credenciales ARCA detectadas: usando WsfeArcaProvider (real).');
      const production = config.get<string>('ARCA_PRODUCTION') === 'true';
      return new WsfeArcaProvider(cuit, certPath, keyPath, production);
    }
    logger.log('Sin credenciales ARCA: usando MockArcaProvider (CAE simulado).');
    return mock;
  },
};
