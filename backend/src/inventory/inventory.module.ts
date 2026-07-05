import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { InventoryController } from './inventory.controller';

@Module({
  providers: [StockService],
  controllers: [InventoryController],
  exports: [StockService],
})
export class InventoryModule {}
