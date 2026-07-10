import { Module } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { MaterialsController } from './materials.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [MaterialsService],
  controllers: [MaterialsController],
  exports: [MaterialsService],
})
export class MaterialsModule {}
