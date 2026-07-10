import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { PaymentsService } from './payments.service';
import { AccountsController } from './accounts.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [LedgerService, PaymentsService],
  controllers: [AccountsController],
  exports: [LedgerService, PaymentsService],
})
export class AccountsModule {}
