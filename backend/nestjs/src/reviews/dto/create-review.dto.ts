import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Min, Max, IsNumber } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 'bookingId123' })
  @IsString()
  @IsNotEmpty()
  booking_id: string;

  @ApiProperty({ example: 'tool' })
  @IsEnum(['owner', 'renter', 'tool'])
  target_type: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ example: 'Great tool, worked perfectly for my project.' })
  @IsString()
  @IsNotEmpty()
  comment: string;

  @ApiProperty({ example: 'good', required: false })
  @IsOptional()
  @IsEnum(['like_new', 'good', 'fair', 'poor'])
  condition_tag?: string;
}
