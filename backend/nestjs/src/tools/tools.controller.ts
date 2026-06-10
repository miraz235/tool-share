import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ToolsService } from './tools.service';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';

@ApiTags('tools')
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tool listing' })
  @ApiResponse({ status: 201, description: 'Tool created successfully.' })
  create(@Body() dto: CreateToolDto) {
    return this.toolsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tools' })
  @ApiResponse({ status: 200, description: 'Tool list returned successfully.' })
  findAll() {
    return this.toolsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one tool by ID' })
  @ApiResponse({ status: 200, description: 'Tool returned successfully.' })
  findOne(@Param('id') id: string) {
    return this.toolsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tool listing' })
  @ApiResponse({ status: 200, description: 'Tool updated successfully.' })
  update(@Param('id') id: string, @Body() dto: UpdateToolDto) {
    return this.toolsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tool listing' })
  @ApiResponse({ status: 200, description: 'Tool deleted successfully.' })
  remove(@Param('id') id: string) {
    return this.toolsService.delete(id);
  }
}
