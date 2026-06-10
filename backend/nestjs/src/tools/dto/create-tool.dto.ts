import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ToolLocationDto {
  @ApiProperty({ example: '123 Main St', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Seattle' })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty({ example: '98101', required: false })
  @IsOptional()
  @IsString()
  postal_code?: string;

  @ApiProperty({ example: 47.6062 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: -122.3321 })
  @IsNumber()
  lng: number;
}

export class CreateToolDto {
  @ApiProperty({ example: 'Cordless Drill' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'Powerful cordless drill for home projects.' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ example: 'power-tools' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ example: 45.0 })
  @IsNumber()
  daily_price: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  security_deposit?: number;

  @ApiProperty({ example: 'Good', required: false })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiProperty({ type: [String], example: ['https://example.com/drill.jpg'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({ type: () => ToolLocationDto })
  @ValidateNested()
  @Type(() => ToolLocationDto)
  location: ToolLocationDto;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  pickup_available?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  delivery_available?: boolean;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  delivery_radius_km?: number;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  unavailable_dates?: string[];

  @ApiProperty({ example: 'rent', required: false })
  @IsOptional()
  @IsString()
  listing_type?: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  sale_price?: number;

  @ApiProperty({ example: 'USD', required: false })
  @IsOptional()
  @IsString()
  price_currency?: string;

  @ApiProperty({ example: 'userId123' })
  @IsNotEmpty()
  @IsString()
  owner_id: string;
}
