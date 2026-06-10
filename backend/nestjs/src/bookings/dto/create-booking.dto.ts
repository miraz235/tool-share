import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: 'toolId123' })
  @IsString()
  @IsNotEmpty()
  tool_id: string;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({ example: '2026-06-16' })
  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @ApiProperty({ example: 'pickup', required: false })
  @IsOptional()
  @IsEnum(['pickup', 'delivery'])
  pickup_method?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsOptional()
  @IsString()
  delivery_address?: string;

  @ApiProperty({ example: 'Please leave toolbox by door', required: false })
  @IsOptional()
  @IsString()
  message_to_owner?: string;

  @ApiProperty({ example: 'basic', required: false })
  @IsOptional()
  @IsEnum(['none', 'basic', 'premium'])
  insurance_tier?: string;
}
