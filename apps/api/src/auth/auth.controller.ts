import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AuthService, RequestMeta } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private meta(req: Request): RequestMeta {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registra tenant + sucursal principal + usuario Dueño' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.meta(req));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login con email y password (+ tenantSlug opcional)' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.meta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rota el refresh token (revoca la sesión anterior)' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.meta(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoca la sesión del refresh token' })
  logout(@CurrentUser() user: JwtPayload, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(user.sub, dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario actual con roles y permisos' })
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub, user.tenantId);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sesiones del usuario (auditoría)' })
  sessions(@CurrentUser() user: JwtPayload) {
    return this.authService.sessions(user.sub);
  }
}
