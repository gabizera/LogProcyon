import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, Request, Query } from '@nestjs/common';
import { InputsService } from './inputs.service';
import { CreateInputDto, UpdateInputDto } from './dto/input.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('inputs')
export class InputsController {
  constructor(private readonly inputsService: InputsService) {}

  @Get()
  findAll(@Request() req: any, @Query('include_archived') includeArchived?: string) {
    const all = this.inputsService.findAllForUser(req.user);
    if (includeArchived === '1' || includeArchived === 'true') return all;
    return all.filter(i => !i.archived_at);
  }

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

  @Put(':id/restore')
  @Roles('admin', 'operator')
  restore(@Param('id') id: string) {
    return this.inputsService.restore(id);
  }

  /**
   * DELETE vira soft-delete (archive). Dado fica em nat_logs pra
   * busca judicial, Input some do Dashboard/Logs/dropdown. Use
   * /inputs/:id/purge pra remoção definitiva do JSON.
   */
  @Delete(':id')
  @Roles('admin', 'operator')
  archive(@Param('id') id: string) {
    return this.inputsService.archive(id);
  }

  @Delete(':id/purge')
  @Roles('admin')
  @HttpCode(204)
  purge(@Param('id') id: string) { this.inputsService.remove(id); }
}
