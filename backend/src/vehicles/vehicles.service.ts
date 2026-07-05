import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({ data: dto });
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

  async update(id: string, dto: UpdateVehicleDto) {
    await this.findOne(id);
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.vehicle.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
