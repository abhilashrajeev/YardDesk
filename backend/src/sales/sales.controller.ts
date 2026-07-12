import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleDto, CreatePassDto } from './dto';
import { CurrentUser, AuthUser, RequirePermission } from '../auth/decorators';

@Controller('sales')
export class SalesController {
  constructor(private sales: SalesService) {}

  @RequirePermission(Permission.SALES)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.sales.create(dto, user.userId);
  }

  @Get()
  list(
    @Query('customerId') customerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sales.list({ customerId, from, to });
  }

  // Must be declared before ':id' so it isn't swallowed by that param route.
  @Get('outstanding')
  outstanding() {
    return this.sales.findOutstanding();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sales.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateSaleDto) {
    return this.sales.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sales.remove(id, user.userId);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sales.restore(id, user.userId);
  }

  @Delete(':id/permanent')
  hardDelete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sales.hardDelete(id, user.userId);
  }

  @Post(':id/gate-pass')
  gatePass(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePassDto,
  ) {
    return this.sales.createGatePass(id, user.userId, dto);
  }

  @Post(':id/loading-pass')
  loadingPass(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePassDto,
  ) {
    return this.sales.createLoadingPass(id, user.userId, dto);
  }
}
