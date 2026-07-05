import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PartyType, Role } from '@prisma/client';
import { LedgerService } from './ledger.service';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './payments.dto';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';

@Controller('accounts')
export class AccountsController {
  constructor(
    private ledger: LedgerService,
    private payments: PaymentsService,
  ) {}

  // --- Payments ---
  @Post('payments')
  createPayment(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(dto, user.userId);
  }

  @Get('payments')
  listPayments(
    @Query('customerId') customerId?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.payments.list({ customerId, vendorId });
  }

  // --- Ledgers ---
  @Get('customers/:id/ledger')
  customerLedger(@Param('id') id: string) {
    return this.ledger.getLedger(PartyType.CUSTOMER, id);
  }

  @Get('vendors/:id/ledger')
  vendorLedger(@Param('id') id: string) {
    return this.ledger.getLedger(PartyType.VENDOR, id);
  }

  // --- Outstanding ---
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('outstanding/customers')
  customerOutstanding() {
    return this.ledger.outstanding(PartyType.CUSTOMER);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('outstanding/vendors')
  vendorOutstanding() {
    return this.ledger.outstanding(PartyType.VENDOR);
  }
}
