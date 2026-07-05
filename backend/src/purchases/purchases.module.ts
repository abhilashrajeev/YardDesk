import { Module } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [InventoryModule, AccountsModule],
  providers: [PurchasesService],
  controllers: [PurchasesController],
})
export class PurchasesModule {}
