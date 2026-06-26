import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'La Parrilla de Juan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  tenantName!: string;

  @ApiProperty({ example: 'Casa Central' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  branchName!: string;

  @ApiProperty({ example: 'juan@parrilla.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;
}
