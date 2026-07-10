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
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMode } from '@prisma/client';

export class SaleItemDto {
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

export class CreateSaleDto {
  @IsOptional()
  @IsString()
  clientUuid?: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @IsEnum(PaymentMode)
  paymentMode!: PaymentMode;

  // For CREDIT sales: optional part-payment collected upfront.
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/** All fields optional — only what's provided gets changed. Items, if provided, fully replace the line items. */
export class UpdateSaleDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsOptional() @IsNumber() @Min(0) freight?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items?: SaleItemDto[];

  @IsOptional() @IsEnum(PaymentMode) paymentMode?: PaymentMode;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreatePassDto {
  @IsOptional()
  @IsString()
  clientUuid?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
