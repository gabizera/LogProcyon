import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  findAll() { return this.usersService.findAll(); }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string) { return this.usersService.findOne(id); }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }

  @Put(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  remove(@Param('id') id: string) { this.usersService.remove(id); }
}
