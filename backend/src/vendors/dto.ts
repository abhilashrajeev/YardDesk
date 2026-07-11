import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() openingBalance?: number;
}

export class UpdateVendorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() openingBalance?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AddVendorVehicleDto {
  @IsString()
  @IsNotEmpty()
  vehicleNumber!: string;

  @IsNumber()
  defaultQuantity!: number;
}

export class UpdateVendorVehicleDto {
  @IsNumber()
  defaultQuantity!: number;
}
