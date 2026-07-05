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
  @IsBoolean()
  isActive?: boolean;
}
