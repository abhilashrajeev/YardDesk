import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { Unit } from '@prisma/client';

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(Unit)
  unit!: Unit;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultRate?: number;

  // Rate for buying in the material's own unit.
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseRate?: number;

  // Rate for buying by the ton (only meaningful when unit = CFT). Its presence
  // is what turns on "buy by the ton" for this material on the purchase form.
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseRateTon?: number;
}

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Unit)
  unit?: Unit;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseRateTon?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
