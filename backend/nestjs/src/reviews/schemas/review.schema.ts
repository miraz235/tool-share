import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReviewDocument = Review & Document;

@Schema()
export class Review {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  booking_id: string;

  @Prop({ required: true })
  tool_id: string;

  @Prop({ required: true })
  reviewer_id: string;

  @Prop()
  target_user_id?: string;

  @Prop({ required: true })
  target_type: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true })
  comment: string;

  @Prop()
  condition_tag?: string;

  @Prop({ default: false })
  hidden: boolean;

  @Prop({ default: () => new Date().toISOString() })
  created_at: string;

  @Prop({ default: () => new Date().toISOString() })
  updated_at: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
