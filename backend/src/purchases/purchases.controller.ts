import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permission, Role } from '@prisma/client';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto';
import { CurrentUser, AuthUser, RequirePermission, Roles } from '../auth/decorators';

@Controller('purchases')
export class PurchasesController {
  constructor(private purchases: PurchasesService) {}

  @RequirePermission(Permission.PURCHASES)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseDto) {
    return this.purchases.create(dto, user.userId);
  }

  @Get()
  list(
    @Query('vendorId') vendorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.purchases.list({ vendorId, from, to });
  }

  // Must be declared before ':id' so it isn't swallowed by that param route.
  @Get('outstanding')
  outstanding() {
    return this.purchases.findOutstanding();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchases.findOne(id);
  }

  @RequirePermission(Permission.PURCHASES)
  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdatePurchaseDto) {
    return this.purchases.update(id, dto, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.purchases.remove(id, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.purchases.restore(id, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id/permanent')
  hardDelete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.purchases.hardDelete(id, user.userId);
  }
}
