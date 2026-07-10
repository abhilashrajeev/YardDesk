import { Module } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [InventoryModule, AccountsModule, AuditModule],
  providers: [PurchasesService],
  controllers: [PurchasesController],
})
export class PurchasesModule {}
