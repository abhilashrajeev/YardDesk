import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [InventoryModule, AccountsModule, AuditModule],
  providers: [SalesService],
  controllers: [SalesController],
})
export class SalesModule {}
