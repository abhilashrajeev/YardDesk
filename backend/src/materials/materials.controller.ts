import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Delete,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto, UpdateMaterialDto } from './dto';
import { Roles } from '../auth/decorators';

@Controller('materials')
export class MaterialsController {
  constructor(private materials: MaterialsService) {}

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.materials.findAll(includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.materials.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  create(@Body() dto: CreateMaterialDto) {
    return this.materials.create(dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.materials.update(id, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.materials.deactivate(id);
  }
}
