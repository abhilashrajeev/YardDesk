import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialDto, UpdateMaterialDto } from './dto';

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateMaterialDto) {
    return this.prisma.material.create({ data: dto });
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

  async update(id: string, dto: UpdateMaterialDto) {
    await this.findOne(id);
    return this.prisma.material.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.material.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
