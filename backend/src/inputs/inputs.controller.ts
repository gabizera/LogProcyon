import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, Request } from '@nestjs/common';
import { InputsService } from './inputs.service';
import { CreateInputDto, UpdateInputDto } from './dto/input.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('inputs')
export class InputsController {
  constructor(private readonly inputsService: InputsService) {}

  @Get()
  findAll(@Request() req: any) { return this.inputsService.findAllForUser(req.user); }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.inputsService.findOne(id, req.user);
  }

  @Post()
  @Roles('admin', 'operator')
  create(@Body() dto: CreateInputDto) { return this.inputsService.create(dto); }

  @Put(':id')
  @Roles('admin', 'operator')
  update(@Param('id') id: string, @Body() dto: UpdateInputDto) {
    return this.inputsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  remove(@Param('id') id: string) { this.inputsService.remove(id); }
}
