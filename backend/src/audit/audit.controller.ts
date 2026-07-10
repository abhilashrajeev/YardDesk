import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { Roles } from '../auth/decorators';

/** Super-admin only: full history of edits/deletes across the ERP. */
@Roles(Role.SUPER_ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  list(@Query('entityType') entityType?: string) {
    return this.audit.list({ entityType });
  }
}
