import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  ValidateIf,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { PartyType, PaymentDirection, PaymentMode } from '@prisma/client';

export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  clientUuid?: string;

  @IsEnum(PartyType)
  partyType!: PartyType;

  @ValidateIf((o) => o.partyType === PartyType.CUSTOMER)
  @IsString()
  @IsNotEmpty()
  customerId?: string;

  @ValidateIf((o) => o.partyType === PartyType.VENDOR)
  @IsString()
  @IsNotEmpty()
  vendorId?: string;

  @IsEnum(PaymentDirection)
  direction!: PaymentDirection;

  @IsEnum(PaymentMode)
  mode!: PaymentMode;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  // Default true: FIFO-split the payment across the party's oldest open bills first
  // (may produce several linked Payment rows). Set false to record it as one lump
  // payment against the party's overall balance, not tied to any specific bill.
  @IsOptional()
  @IsBoolean()
  autoApply?: boolean;
}

export class UpdatePaymentDto {
  @IsOptional() @IsEnum(PaymentMode) mode?: PaymentMode;
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() date?: string;
}

// Links (or unlinks, when txnId is null) a payment to a specific purchase/sale invoice.
// Which one it targets is inferred from the payment's own partyType.
export class AllocatePaymentDto {
  @ValidateIf((o) => o.txnId !== null)
  @IsString()
  @IsNotEmpty()
  txnId!: string | null;
}
