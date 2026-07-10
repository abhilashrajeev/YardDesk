import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, Permission } from '@prisma/client';

export const ROLES_KEY = 'roles';
/** Restrict a route to one or more roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
/** Restrict a route to users holding this module permission (SUPER_ADMIN always passes). */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const IS_PUBLIC_KEY = 'isPublic';
/** Mark a route as accessible without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export interface AuthUser {
  userId: string;
  role: Role;
  name: string;
  permissions: Permission[];
}

/** Inject the authenticated user into a handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
