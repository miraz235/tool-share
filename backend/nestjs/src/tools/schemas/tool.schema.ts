import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ToolDocument = Tool & Document;

@Schema()
export class Tool {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  owner_id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  daily_price: number;

  @Prop({ default: 0 })
  security_deposit: number;

  @Prop({ default: 'Good' })
  condition: string;

  @Prop({ default: [] })
  images: string[];

  @Prop({
    type: {
      address: String,
      city: { type: String, required: true },
      postal_code: String,
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    required: true,
  })
  location: {
    address?: string;
    city: string;
    postal_code?: string;
    lat: number;
    lng: number;
  };

  @Prop({ default: true })
  pickup_available: boolean;

  @Prop({ default: false })
  delivery_available: boolean;

  @Prop({ default: 0 })
  delivery_radius_km: number;

  @Prop({ default: [] })
  unavailable_dates: string[];

  @Prop({ default: 'rent' })
  listing_type: string;

  @Prop({ default: 0 })
  sale_price: number;

  @Prop({ default: 'USD' })
  price_currency: string;

  @Prop({ default: true })
  is_available: boolean;

  @Prop({ default: false })
  is_sold: boolean;

  @Prop({ default: false })
  is_featured: boolean;

  @Prop({ default: 0 })
  view_count: number;

  @Prop({ default: 0 })
  rating_avg: number;

  @Prop({ default: 0 })
  rating_count: number;

  @Prop({ default: () => new Date().toISOString() })
  created_at: string;

  @Prop({ default: () => new Date().toISOString() })
  updated_at: string;
}

export const ToolSchema = SchemaFactory.createForClass(Tool);
