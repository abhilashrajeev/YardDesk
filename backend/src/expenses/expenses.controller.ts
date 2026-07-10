import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permission, Role } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto, RenameCategoryDto, RemoveCategoryDto } from './dto';
import { CurrentUser, AuthUser, RequirePermission, Roles } from '../auth/decorators';

@Controller('expenses')
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @RequirePermission(Permission.EXPENSES)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(dto, user.userId);
  }

  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string) {
    return this.expenses.list({ from, to });
  }

  // Categories aren't their own resource with an :id — declared before ':id' isn't required
  // since these are POST, but keeping them grouped together for readability.
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('categories/rename')
  renameCategory(@CurrentUser() user: AuthUser, @Body() dto: RenameCategoryDto) {
    return this.expenses.renameCategory(dto.from, dto.to, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('categories/remove')
  removeCategory(@CurrentUser() user: AuthUser, @Body() dto: RemoveCategoryDto) {
    return this.expenses.removeCategory(dto.name, user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.expenses.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateExpenseDto) {
    return this.expenses.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.expenses.remove(id, user.userId);
  }
}
