import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsString() ownerPhone?: string;
  @IsOptional() @IsNumber() @Min(0) capacity?: number;
  @IsOptional() @IsNumber() @Min(0) extraBodyCft?: number;
  @IsOptional() @IsString() driverName?: string;
  @IsOptional() @IsString() driverPhone?: string;
}

export class UpdateVehicleDto {
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsString() ownerPhone?: string;
  @IsOptional() @IsNumber() @Min(0) capacity?: number;
  @IsOptional() @IsNumber() @Min(0) extraBodyCft?: number;
  @IsOptional() @IsString() driverName?: string;
  @IsOptional() @IsString() driverPhone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
