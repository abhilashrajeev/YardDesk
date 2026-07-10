import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, userId: string) {
    const customer = await this.prisma.customer.create({ data: dto });
    await this.audit.log({
      entityType: 'CUSTOMER',
      entityId: customer.id,
      action: AuditAction.CREATE,
      summary: `Customer added: ${customer.name}`,
      after: customer,
      userId,
    });
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
}
