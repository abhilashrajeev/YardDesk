import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { InventoryController } from './inventory.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [StockService],
  controllers: [InventoryController],
  exports: [StockService],
})
export class InventoryModule {}
