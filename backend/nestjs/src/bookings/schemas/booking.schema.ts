import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BookingDocument = Booking & Document;

@Schema()
export class Booking {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  tool_id: string;

  @Prop({ required: true })
  renter_id: string;

  @Prop({ required: true })
  owner_id: string;

  @Prop({ required: true })
  start_date: string;

  @Prop({ required: true })
  end_date: string;

  @Prop({ default: 0 })
  total_price: number;

  @Prop({ default: 0 })
  deposit: number;

  @Prop({ default: 'pending' })
  status: string;

  @Prop({ default: 'pickup' })
  pickup_method: string;

  @Prop()
  delivery_address?: string;

  @Prop()
  message_to_owner?: string;

  @Prop({ default: 'none' })
  insurance_tier: string;

  @Prop({ default: 0 })
  insurance_fee: number;

  @Prop({ default: false })
  paid: boolean;

  @Prop({ default: () => new Date().toISOString() })
  created_at: string;

  @Prop({ default: () => new Date().toISOString() })
  updated_at: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
