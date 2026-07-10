import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  IsArray,
  MinLength,
  ArrayUnique,
} from 'class-validator';
import { Permission, Role } from '@prisma/client';

// Only ADMIN/EMPLOYEE can be created or edited here — SUPER_ADMIN is provisioned
// outside the app (seed script) to avoid accidentally minting a second owner.
const ASSIGNABLE_ROLES = [Role.ADMIN, Role.EMPLOYEE];

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(ASSIGNABLE_ROLES)
  role!: Role;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(Object.values(Permission), { each: true })
  permissions?: Permission[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsIn(ASSIGNABLE_ROLES) role?: Role;
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(Object.values(Permission), { each: true }) permissions?: Permission[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(6) password?: string;
}
