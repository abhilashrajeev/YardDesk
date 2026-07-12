import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { ProductionService } from './production.service';
import { CreateProductionDto, UpdateProductionDto } from './dto';
import { CurrentUser, AuthUser, RequirePermission } from '../auth/decorators';

@Controller('production')
export class ProductionController {
  constructor(private production: ProductionService) {}

  @RequirePermission(Permission.STOCK)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductionDto) {
    return this.production.create(dto, user.userId);
  }

  @RequirePermission(Permission.STOCK)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductionDto, @CurrentUser() user: AuthUser) {
    return this.production.update(id, dto, user.userId);
  }

  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string) {
    return this.production.list({ from, to });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.production.findOne(id);
  }

  @RequirePermission(Permission.STOCK)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.production.remove(id, user.userId);
  }
}
