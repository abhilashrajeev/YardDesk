import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';

@Controller('vehicles')
export class VehiclesController {
  constructor(private vehicles: VehiclesService) {}

  @Get()
  findAll() {
    return this.vehicles.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehicles.findOne(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(dto, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateVehicleDto) {
    return this.vehicles.update(id, dto, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.vehicles.deactivate(id, user.userId);
  }
}
