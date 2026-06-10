import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { Booking, BookingDocument } from './schemas/booking.schema';

@Injectable()
export class BookingsService {
  constructor(@InjectModel(Booking.name) private bookingModel: Model<BookingDocument>) {}

  create(dto: CreateBookingDto, renter_id: string, owner_id: string, total_price: number, deposit: number) {
    const booking = new this.bookingModel({
      ...dto,
      id: `bk_${Math.random().toString(36).slice(2, 14)}`,
      renter_id,
      owner_id,
      total_price,
      deposit,
      status: 'pending',
      insurance_fee: 0,
      paid: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return booking.save();
  }

  findAll() {
    return this.bookingModel.find().exec();
  }

  findById(id: string) {
    return this.bookingModel.findOne({ id }).exec();
  }

  update(id: string, dto: UpdateBookingDto) {
    return this.bookingModel.findOneAndUpdate({ id }, { ...dto, updated_at: new Date().toISOString() }, { new: true }).exec();
  }

  delete(id: string) {
    return this.bookingModel.findOneAndDelete({ id }).exec();
  }
}
