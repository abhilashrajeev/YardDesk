import { Module } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [InventoryModule, AuditModule],
  providers: [ProductionService],
  controllers: [ProductionController],
})
export class ProductionModule {}
