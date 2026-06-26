import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@demo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({
    example: 'demo',
    description: 'Necesario solo si el email existe en más de un tenant',
  })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
