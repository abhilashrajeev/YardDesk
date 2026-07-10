import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateVendorDto, UpdateVendorDto } from './dto';

@Injectable()
export class VendorsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateVendorDto, userId: string) {
    const vendor = await this.prisma.vendor.create({ data: dto });
    await this.audit.log({
      entityType: 'VENDOR',
      entityId: vendor.id,
      action: AuditAction.CREATE,
      summary: `Vendor added: ${vendor.name}`,
      after: vendor,
      userId,
    });
    return vendor;
  }

  findAll(search?: string) {
    return this.prisma.vendor.findMany({
      where: {
        isActive: true,
        ...(search
          ? { name: { contains: search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async update(id: string, dto: UpdateVendorDto, userId: string) {
    const before = await this.findOne(id);
    const vendor = await this.prisma.vendor.update({ where: { id }, data: dto });
    await this.audit.log({
      entityType: 'VENDOR',
      entityId: id,
      action: AuditAction.UPDATE,
      summary: `Vendor edited: ${vendor.name}`,
      before,
      after: vendor,
      userId,
    });
    return vendor;
  }

  async deactivate(id: string, userId: string) {
    const before = await this.findOne(id);
    const vendor = await this.prisma.vendor.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      entityType: 'VENDOR',
      entityId: id,
      action: AuditAction.DELETE,
      summary: `Vendor deleted: ${before.name}`,
      before,
      userId,
    });
    return vendor;
  }
}
