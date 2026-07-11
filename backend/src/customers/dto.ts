import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsNumber()
  openingBalance?: number;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
  @IsOptional() @IsNumber() openingBalance?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AddCustomerVehicleDto {
  @IsString()
  @IsNotEmpty()
  vehicleNumber!: string;

  /** Always in cft. */
  @IsNumber()
  quantityCft!: number;

  /** Some trucks add a second body for extra load — optional, also cft. */
  @IsOptional()
  @IsNumber()
  extraBodyCft?: number;
}

export class UpdateCustomerVehicleDto {
  @IsOptional() @IsNumber() quantityCft?: number;
  @IsOptional() @IsNumber() extraBodyCft?: number;
}
