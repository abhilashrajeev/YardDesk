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
import { VendorsService } from './vendors.service';
import { CreateVendorDto, UpdateVendorDto } from './dto';
import { Roles } from '../auth/decorators';

@Controller('vendors')
export class VendorsController {
  constructor(private vendors: VendorsService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.vendors.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendors.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  create(@Body() dto: CreateVendorDto) {
    return this.vendors.create(dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendors.update(id, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.vendors.deactivate(id);
  }
}
