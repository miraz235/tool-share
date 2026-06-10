import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'email', required: false })
  @IsOptional()
  @IsString()
  auth_provider?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  is_verified?: boolean;

  @ApiProperty({ example: 'hashed_password', required: false })
  @IsOptional()
  @IsString()
  password_hash?: string;
}
