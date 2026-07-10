import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  ValidateIf,
  IsDateString,
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
}

export class UpdatePaymentDto {
  @IsOptional() @IsEnum(PaymentMode) mode?: PaymentMode;
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() date?: string;
}
