import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateMaterialDto, UpdateMaterialDto } from './dto';

@Injectable()
export class MaterialsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateMaterialDto, userId: string) {
    const material = await this.prisma.material.create({ data: dto });
    await this.audit.log({
      entityType: 'MATERIAL',
      entityId: material.id,
      action: AuditAction.CREATE,
      summary: `Material added: ${material.name}`,
      after: material,
      userId,
    });
    return material;
  }

  findAll(includeInactive = false) {
    return this.prisma.material.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  async update(id: string, dto: UpdateMaterialDto, userId: string) {
    const before = await this.findOne(id);
    const material = await this.prisma.material.update({ where: { id }, data: dto });
    await this.audit.log({
      entityType: 'MATERIAL',
      entityId: id,
      action: AuditAction.UPDATE,
      summary: `Material edited: ${material.name}`,
      before,
      after: material,
      userId,
    });
    return material;
  }

  async deactivate(id: string, userId: string) {
    const before = await this.findOne(id);
    const material = await this.prisma.material.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      entityType: 'MATERIAL',
      entityId: id,
      action: AuditAction.DELETE,
      summary: `Material deleted: ${before.name}`,
      before,
      userId,
    });
    return material;
  }
}
