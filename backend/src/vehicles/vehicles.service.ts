import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';

@Injectable()
export class VehiclesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateVehicleDto, userId: string) {
    const number = dto.number.trim();
    // The number is unique regardless of isActive, so re-adding one that was
    // previously deleted would otherwise hit the DB's unique constraint —
    // reactivate that same record instead of trying to insert a duplicate.
    const existing = await this.prisma.vehicle.findFirst({
      where: { number: { equals: number, mode: 'insensitive' } },
    });
    if (existing && existing.isActive) {
      throw new ConflictException('A vehicle with this number already exists.');
    }

    const vehicle = existing
      ? await this.prisma.vehicle.update({ where: { id: existing.id }, data: { ...dto, number, isActive: true } })
      : await this.prisma.vehicle.create({ data: { ...dto, number } });

    await this.audit.log({
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      summary: existing ? `Vehicle restored: ${vehicle.number}` : `Vehicle added: ${vehicle.number}`,
      after: vehicle,
      userId,
    });
    return vehicle;
  }

  findAll() {
    return this.prisma.vehicle.findMany({
      where: { isActive: true },
      // Most recently added first — easier to find what you just entered than
      // scanning an alphabetical list.
      orderBy: { createdAt: 'desc' },
      include: {
        customerVehicles: { include: { customer: { select: { id: true, name: true } } } },
        vendorVehicles: { include: { vendor: { select: { id: true, name: true } } } },
      },
    });
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto, userId: string) {
    const before = await this.findOne(id);
    const vehicle = await this.prisma.vehicle.update({ where: { id }, data: dto });
    await this.audit.log({
      entityType: 'VEHICLE',
      entityId: id,
      action: AuditAction.UPDATE,
      summary: `Vehicle edited: ${vehicle.number}`,
      before,
      after: vehicle,
      userId,
    });
    return vehicle;
  }

  async deactivate(id: string, userId: string) {
    const before = await this.findOne(id);
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      entityType: 'VEHICLE',
      entityId: id,
      action: AuditAction.DELETE,
      summary: `Vehicle deleted: ${before.number}`,
      before,
      userId,
    });
    return vehicle;
  }
}
