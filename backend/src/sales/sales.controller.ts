import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto, CreatePassDto } from './dto';
import { CurrentUser, AuthUser } from '../auth/decorators';

@Controller('sales')
export class SalesController {
  constructor(private sales: SalesService) {}

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sales.findOne(id);
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
