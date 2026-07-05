import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto, UpdateVendorDto } from './dto';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateVendorDto) {
    return this.prisma.vendor.create({ data: dto });
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

  async update(id: string, dto: UpdateVendorDto) {
    await this.findOne(id);
    return this.prisma.vendor.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.vendor.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
