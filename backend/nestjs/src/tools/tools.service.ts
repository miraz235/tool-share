import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { Tool, ToolDocument } from './schemas/tool.schema';

@Injectable()
export class ToolsService {
  constructor(@InjectModel(Tool.name) private toolModel: Model<ToolDocument>) {}

  create(dto: CreateToolDto) {
    const tool = new this.toolModel({
      ...dto,
      id: `tool_${Math.random().toString(36).slice(2, 14)}`,
      is_available: true,
      is_sold: false,
      is_featured: false,
      view_count: 0,
      rating_avg: 0,
      rating_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return tool.save();
  }

  findAll() {
    return this.toolModel.find().exec();
  }

  findById(id: string) {
    return this.toolModel.findOne({ id }).exec();
  }

  update(id: string, dto: UpdateToolDto) {
    return this.toolModel.findOneAndUpdate({ id }, { ...dto, updated_at: new Date().toISOString() }, { new: true }).exec();
  }

  delete(id: string) {
    return this.toolModel.findOneAndDelete({ id }).exec();
  }
}
