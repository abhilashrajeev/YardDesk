import { Injectable, NotFoundException } from '@nestjs/common';
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
    const vehicle = await this.prisma.vehicle.create({ data: dto });
    await this.audit.log({
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      action: AuditAction.CREATE,
      summary: `Vehicle added: ${vehicle.number}`,
      after: vehicle,
      userId,
    });
    return vehicle;
  }

  findAll() {
    return this.prisma.vehicle.findMany({
      where: { isActive: true },
      orderBy: { number: 'asc' },
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
