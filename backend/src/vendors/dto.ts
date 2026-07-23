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

  /** Lets a vendor's usual vehicle be registered in the same step as adding the vendor. */
  @IsOptional() @IsString() vehicleNumber?: string;
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

  /** Optional so a vehicle can be linked before its usual quantity is known. */
  @IsOptional()
  @IsNumber()
  defaultQuantity?: number;
}

export class UpdateVendorVehicleDto {
  @IsNumber()
  defaultQuantity!: number;
}
