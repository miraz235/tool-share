import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ToolsModule } from './tools/tools.module';
import { BookingsModule } from './bookings/bookings.module';
import { ReviewsModule } from './reviews/reviews.module';
import { User, UserSchema } from './users/schemas/user.schema';
import { Tool, ToolSchema } from './tools/schemas/tool.schema';
import { Booking, BookingSchema } from './bookings/schemas/booking.schema';
import { Review, ReviewSchema } from './reviews/schemas/review.schema';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost/toolshare'),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tool.name, schema: ToolSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
    AuthModule,
    UsersModule,
    ToolsModule,
    BookingsModule,
    ReviewsModule,
  ],
})
export class AppModule {}
