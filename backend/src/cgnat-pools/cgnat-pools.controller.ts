import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode } from '@nestjs/common';
import { CgnatPoolsService } from './cgnat-pools.service';
import { CreateCgnatPoolDto, UpdateCgnatPoolDto, LookupCgnatDto } from './dto/cgnat-pool.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('cgnat-pools')
export class CgnatPoolsController {
  constructor(private readonly svc: CgnatPoolsService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get('lookup')
  lookup(@Query() dto: LookupCgnatDto) {
    return this.svc.lookup(dto.equipamento_origem, dto.ip_publico, dto.porta);
  }

  @Post()
  @Roles('admin', 'operator')
  create(@Body() dto: CreateCgnatPoolDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'operator')
  update(@Param('id') id: string, @Body() dto: UpdateCgnatPoolDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    this.svc.remove(id);
  }
}
