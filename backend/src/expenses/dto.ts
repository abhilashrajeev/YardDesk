import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsEnum, IsDateString } from 'class-validator';
import { PaymentMode } from '@prisma/client';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsEnum(PaymentMode)
  mode?: PaymentMode;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class UpdateExpenseDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsEnum(PaymentMode) mode?: PaymentMode;
  @IsOptional() @IsDateString() date?: string;
}

export class RenameCategoryDto {
  @IsString()
  @IsNotEmpty()
  from!: string;

  @IsString()
  @IsNotEmpty()
  to!: string;
}

export class RemoveCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
