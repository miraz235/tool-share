import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  password_hash?: string;

  @Prop()
  picture?: string;

  @Prop()
  bio?: string;

  @Prop()
  city?: string;

  @Prop({ default: 'email' })
  auth_provider: string;

  @Prop({ default: false })
  is_verified: boolean;

  @Prop({ default: 0 })
  rating_avg: number;

  @Prop({ default: 0 })
  rating_count: number;

  @Prop({ default: false })
  is_admin: boolean;

  @Prop({ default: false })
  is_suspended: boolean;

  @Prop({ default: () => new Date().toISOString() })
  created_at: string;

  @Prop({ default: () => new Date().toISOString() })
  updated_at: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
