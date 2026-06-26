import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'mozo@demo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Carlos' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Gómez' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ type: [String], description: 'IDs de roles (del tenant o de sistema)' })
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds!: string[];

  @ApiPropertyOptional({ type: [String], description: 'IDs de sucursales asignadas' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds?: string[];
}
