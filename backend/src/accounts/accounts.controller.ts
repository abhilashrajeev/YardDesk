import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PartyType, Permission, Role } from '@prisma/client';
import { LedgerService } from './ledger.service';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto } from './payments.dto';
import { Roles, CurrentUser, AuthUser, RequirePermission } from '../auth/decorators';

@Controller('accounts')
export class AccountsController {
  constructor(
    private ledger: LedgerService,
    private payments: PaymentsService,
  ) {}

  // --- Payments ---
  @RequirePermission(Permission.PAYMENTS)
  @Post('payments')
  createPayment(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(dto, user.userId);
  }

  @Get('payments')
  listPayments(
    @Query('customerId') customerId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.payments.list({ customerId, vendorId, from, to });
  }

  @Get('payments/:id')
  findOnePayment(@Param('id') id: string) {
    return this.payments.findOne(id);
  }

  @Patch('payments/:id')
  updatePayment(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdatePaymentDto) {
    return this.payments.update(id, dto, user.userId);
  }

  @Delete('payments/:id')
  removePayment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.remove(id, user.userId);
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
