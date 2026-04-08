import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { InputsService } from './inputs.service';
import { CreateInputDto, UpdateInputDto } from './dto/input.dto';

@Controller('inputs')
export class InputsController {
  constructor(private readonly inputsService: InputsService) {}

  @Get()
  findAll() { return this.inputsService.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.inputsService.findOne(id); }

  @Post()
  create(@Body() dto: CreateInputDto) { return this.inputsService.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInputDto) {
    return this.inputsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) { this.inputsService.remove(id); }
}
