import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [VendorsService],
  controllers: [VendorsController],
  exports: [VendorsService],
})
export class VendorsModule {}
