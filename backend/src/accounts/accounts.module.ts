import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { PaymentsService } from './payments.service';
import { AccountsController } from './accounts.controller';

@Module({
  providers: [LedgerService, PaymentsService],
  controllers: [AccountsController],
  exports: [LedgerService, PaymentsService],
})
export class AccountsModule {}
