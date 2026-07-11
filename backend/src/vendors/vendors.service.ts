import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateVendorDto, UpdateVendorDto, AddVendorVehicleDto, UpdateVendorVehicleDto } from './dto';

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

  // --- Vendor's usual vehicles + typical quantity, for prefilling the purchase form ---

  async listVehicles(vendorId: string) {
    await this.findOne(vendorId);
    return this.prisma.vendorVehicle.findMany({
      where: { vendorId },
      include: { vehicle: { select: { id: true, number: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addVehicle(vendorId: string, dto: AddVendorVehicleDto, userId: string) {
    await this.findOne(vendorId);
    const number = dto.vehicleNumber.trim();

    let vehicle = await this.prisma.vehicle.findFirst({
      where: { number: { equals: number, mode: 'insensitive' } },
    });
    if (!vehicle) {
      vehicle = await this.prisma.vehicle.create({ data: { number } });
    }

    // Re-registering the same vehicle for this vendor just updates the quantity.
    const vv = await this.prisma.vendorVehicle.upsert({
      where: { vendorId_vehicleId: { vendorId, vehicleId: vehicle.id } },
      create: { vendorId, vehicleId: vehicle.id, defaultQuantity: dto.defaultQuantity },
      update: { defaultQuantity: dto.defaultQuantity },
      include: { vehicle: { select: { id: true, number: true } } },
    });
    await this.audit.log({
      entityType: 'VENDOR_VEHICLE',
      entityId: vv.id,
      action: AuditAction.CREATE,
      summary: `Vendor vehicle set: ${vehicle.number} — ${dto.defaultQuantity}`,
      after: vv,
      userId,
    });
    return vv;
  }

  async updateVehicle(vendorId: string, vvId: string, dto: UpdateVendorVehicleDto, userId: string) {
    const before = await this.prisma.vendorVehicle.findFirst({ where: { id: vvId, vendorId } });
    if (!before) throw new NotFoundException('Vendor vehicle entry not found');
    const vv = await this.prisma.vendorVehicle.update({
      where: { id: vvId },
      data: { defaultQuantity: dto.defaultQuantity },
      include: { vehicle: { select: { id: true, number: true } } },
    });
    await this.audit.log({
      entityType: 'VENDOR_VEHICLE',
      entityId: vvId,
      action: AuditAction.UPDATE,
      summary: `Vendor vehicle quantity updated: ${vv.vehicle.number} — ${dto.defaultQuantity}`,
      before,
      after: vv,
      userId,
    });
    return vv;
  }

  async removeVehicle(vendorId: string, vvId: string, userId: string) {
    const before = await this.prisma.vendorVehicle.findFirst({
      where: { id: vvId, vendorId },
      include: { vehicle: { select: { number: true } } },
    });
    if (!before) throw new NotFoundException('Vendor vehicle entry not found');
    await this.prisma.vendorVehicle.delete({ where: { id: vvId } });
    await this.audit.log({
      entityType: 'VENDOR_VEHICLE',
      entityId: vvId,
      action: AuditAction.DELETE,
      summary: `Vendor vehicle removed: ${before.vehicle.number}`,
      before,
      userId,
    });
    return { success: true };
  }
}
