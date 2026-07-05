import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsEnum,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMode } from '@prisma/client';

export class PurchaseItemDto {
  @IsString()
  @IsNotEmpty()
  materialId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  rate!: number;
}

export class CreatePurchaseDto {
  @IsOptional()
  @IsString()
  clientUuid?: string;

  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freight?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];

  // Optional immediate payment to the vendor at purchase time.
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @ValidateIf((o) => o.paidAmount > 0)
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
