import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review, ReviewDocument } from './schemas/review.schema';

@Injectable()
export class ReviewsService {
  constructor(@InjectModel(Review.name) private reviewModel: Model<ReviewDocument>) {}

  create(dto: CreateReviewDto) {
    const review = new this.reviewModel({
      ...dto,
      id: `rev_${Math.random().toString(36).slice(2, 14)}`,
      hidden: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return review.save();
  }

  findAll() {
    return this.reviewModel.find().exec();
  }

  findById(id: string) {
    return this.reviewModel.findOne({ id }).exec();
  }

  update(id: string, dto: UpdateReviewDto) {
    return this.reviewModel.findOneAndUpdate({ id }, { ...dto, updated_at: new Date().toISOString() }, { new: true }).exec();
  }

  delete(id: string) {
    return this.reviewModel.findOneAndDelete({ id }).exec();
  }
}
