import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() driverName?: string;
  @IsOptional() @IsString() driverPhone?: string;
}

export class UpdateVehicleDto {
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() driverName?: string;
  @IsOptional() @IsString() driverPhone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
