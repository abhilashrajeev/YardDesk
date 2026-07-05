import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto';
import { Roles } from '../auth/decorators';

@Controller('inventory')
export class InventoryController {
  constructor(private stock: StockService) {}

  @Get()
  listStock() {
    return this.stock.listStock();
  }

  @Get('movements')
  listMovements(@Query('materialId') materialId?: string) {
    return this.stock.listMovements(materialId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('adjust')
  adjust(@Body() dto: AdjustStockDto) {
    return this.stock.adjust(dto.materialId, dto.quantity, dto.notes);
  }
}
