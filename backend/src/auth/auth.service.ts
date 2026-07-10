import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { Permission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, UpdateProfileDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user.id, user.role, user.name, user.phone, user.permissions);
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    const ok = await argon2.verify(user.passwordHash, current);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(next) },
    });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, role: true, permissions: true },
    });
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  /** Any authenticated user can edit their own name/phone — this is self-service, not the admin Users list. */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const clash = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (clash && clash.id !== userId) {
      throw new ConflictException('A user with this phone number already exists.');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone },
      select: { id: true, name: true, phone: true, role: true, permissions: true },
    });
    return user;
  }

  private async issueTokens(
    userId: string,
    role: string,
    name: string,
    phone: string,
    permissions: Permission[],
  ) {
    // Only `sub` is trusted for authorization — JwtStrategy re-reads role/permissions/isActive
    // from the DB on every request. role/name/phone/permissions here are just for the response body.
    const payload = { sub: userId };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '30d',
    });
    return {
      accessToken,
      refreshToken,
      user: { id: userId, role, name, phone, permissions },
    };
  }

  async refresh(token: string) {
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      // Re-read from the DB so a permission/role change takes effect without waiting
      // for the refresh token itself to expire.
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException('Invalid refresh token');
      return this.issueTokens(user.id, user.role, user.name, user.phone, user.permissions);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
