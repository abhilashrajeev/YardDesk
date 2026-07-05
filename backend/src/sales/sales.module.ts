import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [InventoryModule, AccountsModule],
  providers: [SalesService],
  controllers: [SalesController],
})
export class SalesModule {}
