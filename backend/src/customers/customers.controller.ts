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
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, AddCustomerVehicleDto, UpdateCustomerVehicleDto } from './dto';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';

@Controller('customers')
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.customers.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(dto, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.customers.deactivate(id, user.userId);
  }

  // --- Customer's usual vehicles ---

  @Get(':id/vehicles')
  listVehicles(@Param('id') id: string) {
    return this.customers.listVehicles(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':id/vehicles')
  addVehicle(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: AddCustomerVehicleDto) {
    return this.customers.addVehicle(id, dto, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id/vehicles/:cvId')
  updateVehicle(
    @Param('id') id: string,
    @Param('cvId') cvId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCustomerVehicleDto,
  ) {
    return this.customers.updateVehicle(id, cvId, dto, user.userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id/vehicles/:cvId')
  removeVehicle(@Param('id') id: string, @Param('cvId') cvId: string, @CurrentUser() user: AuthUser) {
    return this.customers.removeVehicle(id, cvId, user.userId);
  }
}
