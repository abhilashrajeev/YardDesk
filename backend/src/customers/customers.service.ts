import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto, UpdateCustomerDto, AddCustomerVehicleDto, UpdateCustomerVehicleDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, userId: string) {
    const { vehicleNumber, ...data } = dto;
    const customer = await this.prisma.customer.create({ data });
    await this.audit.log({
      entityType: 'CUSTOMER',
      entityId: customer.id,
      action: AuditAction.CREATE,
      summary: `Customer added: ${customer.name}`,
      after: customer,
      userId,
    });
    if (vehicleNumber?.trim()) {
      // This endpoint has no role restriction, but re-attributing an *existing* vehicle's
      // owner is an ADMIN-only action (see the @Roles guard on POST /customers/:id/vehicles).
      // Only auto-link here when the number is genuinely new, so this shortcut can't be used
      // to silently reassign someone else's already-registered vehicle.
      const existing = await this.prisma.vehicle.findFirst({
        where: { number: { equals: vehicleNumber.trim(), mode: 'insensitive' } },
      });
      if (!existing) {
        await this.addVehicle(customer.id, { vehicleNumber }, userId);
      }
    }
    return customer;
  }

  findAll(search?: string) {
    return this.prisma.customer.findMany({
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
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, userId: string) {
    const before = await this.findOne(id);
    const customer = await this.prisma.customer.update({ where: { id }, data: dto });
    await this.audit.log({
      entityType: 'CUSTOMER',
      entityId: id,
      action: AuditAction.UPDATE,
      summary: `Customer edited: ${customer.name}`,
      before,
      after: customer,
      userId,
    });
    return customer;
  }

  async deactivate(id: string, userId: string) {
    const before = await this.findOne(id);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      entityType: 'CUSTOMER',
      entityId: id,
      action: AuditAction.DELETE,
      summary: `Customer deleted: ${before.name}`,
      before,
      userId,
    });
    return customer;
  }

  // --- Customer's usual vehicles — quantity (and optional extra-body quantity) in cft ---

  async listVehicles(customerId: string) {
    await this.findOne(customerId);
    return this.prisma.customerVehicle.findMany({
      where: { customerId },
      include: { vehicle: { select: { id: true, number: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addVehicle(customerId: string, dto: AddCustomerVehicleDto, userId: string) {
    const customer = await this.findOne(customerId);
    const number = dto.vehicleNumber.trim();

    let vehicle = await this.prisma.vehicle.findFirst({
      where: { number: { equals: number, mode: 'insensitive' } },
    });
    if (!vehicle) {
      // Brand-new vehicle registered via a customer — stamp the customer as its owner.
      vehicle = await this.prisma.vehicle.create({ data: { number, ownerName: customer.name } });
    } else if (vehicle.ownerName !== customer.name || !vehicle.isActive) {
      // Linking to an existing vehicle re-attributes it to this customer, so the owner
      // name shown on the Vehicles page always matches the party it's actually linked to.
      // Also reactivate it if it was previously deleted — otherwise it'd stay hidden
      // from the Vehicles list despite now being linked again.
      vehicle = await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { ownerName: customer.name, isActive: true },
      });
    }

    const quantityCft = dto.quantityCft ?? (vehicle.capacity ? Number(vehicle.capacity) : 0);
    const cv = await this.prisma.customerVehicle.upsert({
      where: { customerId_vehicleId: { customerId, vehicleId: vehicle.id } },
      create: {
        customerId,
        vehicleId: vehicle.id,
        quantityCft,
        extraBodyCft: dto.extraBodyCft,
      },
      update: {
        quantityCft,
        extraBodyCft: dto.extraBodyCft,
      },
      include: { vehicle: { select: { id: true, number: true } } },
    });
    await this.audit.log({
      entityType: 'CUSTOMER_VEHICLE',
      entityId: cv.id,
      action: AuditAction.CREATE,
      summary: `Customer vehicle set: ${vehicle.number} — ${quantityCft} cft`,
      after: cv,
      userId,
    });
    return cv;
  }

  async updateVehicle(customerId: string, cvId: string, dto: UpdateCustomerVehicleDto, userId: string) {
    const before = await this.prisma.customerVehicle.findFirst({ where: { id: cvId, customerId } });
    if (!before) throw new NotFoundException('Customer vehicle entry not found');
    const cv = await this.prisma.customerVehicle.update({
      where: { id: cvId },
      data: {
        quantityCft: dto.quantityCft ?? undefined,
        extraBodyCft: dto.extraBodyCft,
      },
      include: { vehicle: { select: { id: true, number: true } } },
    });
    await this.audit.log({
      entityType: 'CUSTOMER_VEHICLE',
      entityId: cvId,
      action: AuditAction.UPDATE,
      summary: `Customer vehicle updated: ${cv.vehicle.number}`,
      before,
      after: cv,
      userId,
    });
    return cv;
  }

  async removeVehicle(customerId: string, cvId: string, userId: string) {
    const before = await this.prisma.customerVehicle.findFirst({
      where: { id: cvId, customerId },
      include: { vehicle: { select: { number: true } } },
    });
    if (!before) throw new NotFoundException('Customer vehicle entry not found');
    await this.prisma.customerVehicle.delete({ where: { id: cvId } });
    await this.audit.log({
      entityType: 'CUSTOMER_VEHICLE',
      entityId: cvId,
      action: AuditAction.DELETE,
      summary: `Customer vehicle removed: ${before.vehicle.number}`,
      before,
      userId,
    });
    return { success: true };
  }
}
