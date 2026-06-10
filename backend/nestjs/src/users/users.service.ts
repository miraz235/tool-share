import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  create(dto: CreateUserDto) {
    const createdUser = new this.userModel({
      ...dto,
      id: dto.id || `user_${Math.random().toString(36).slice(2, 14)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return createdUser.save();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  findById(id: string) {
    return this.userModel.findOne({ id }).exec();
  }

  findAll() {
    return this.userModel.find().exec();
  }
}
