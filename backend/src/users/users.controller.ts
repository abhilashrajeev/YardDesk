import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';

// Only the owner manages staff accounts and what they can touch.
@Roles(Role.SUPER_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(dto, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto, user.userId);
  }
}
