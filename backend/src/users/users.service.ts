import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditAction, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto } from './dto';

const SAFE_FIELDS = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  permissions: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      select: SAFE_FIELDS,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('A user with this phone number already exists.');

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        passwordHash: await argon2.hash(dto.password),
        role: dto.role,
        permissions: dto.permissions ?? [],
      },
      select: SAFE_FIELDS,
    });
    await this.audit.log({
      entityType: 'USER',
      entityId: user.id,
      action: AuditAction.CREATE,
      summary: `User added: ${user.name} (${user.role})`,
      after: user,
      userId: actorId,
    });
    return user;
  }

  private async findRaw(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_FIELDS });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const before = await this.findRaw(id);
    if (before.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('The owner account cannot be edited here.');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        role: dto.role,
        permissions: dto.permissions,
        isActive: dto.isActive,
        passwordHash: dto.password ? await argon2.hash(dto.password) : undefined,
      },
      select: SAFE_FIELDS,
    });
    await this.audit.log({
      entityType: 'USER',
      entityId: id,
      action: AuditAction.UPDATE,
      summary: `User edited: ${user.name}${dto.password ? ' (password reset)' : ''}`,
      before,
      after: user,
      userId: actorId,
    });
    return user;
  }
}
