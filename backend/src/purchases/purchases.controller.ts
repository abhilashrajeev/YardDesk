import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto';
import { CurrentUser, AuthUser } from '../auth/decorators';

@Controller('purchases')
export class PurchasesController {
  constructor(private purchases: PurchasesService) {}

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchases.findOne(id);
  }
}
