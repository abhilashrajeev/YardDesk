import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Permission, Role } from '@prisma/client';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto';
import { Roles, CurrentUser, AuthUser, RequirePermission } from '../auth/decorators';

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
  @RequirePermission(Permission.STOCK)
  @Post('adjust')
  adjust(@CurrentUser() user: AuthUser, @Body() dto: AdjustStockDto) {
    return this.stock.adjust(dto.materialId, dto.quantity, dto.notes, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission(Permission.STOCK)
  @Post('adjust/:id/undo')
  undoAdjustment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.stock.undoAdjustment(id, user.userId);
  }
}
