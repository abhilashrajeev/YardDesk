import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto';

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

    return this.issueTokens(user.id, user.role, user.name);
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

  private async issueTokens(
    userId: string,
    role: string,
    name: string,
  ) {
    const payload = { sub: userId, role, name };
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
      user: { id: userId, role, name },
    };
  }

  async refresh(token: string) {
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      return this.issueTokens(payload.sub, payload.role, payload.name);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
