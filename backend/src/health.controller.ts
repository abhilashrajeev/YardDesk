import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  /**
   * Touches the database (not just the API process) so an external keep-alive
   * ping actually prevents Neon's free-tier compute from suspending after a
   * few minutes idle — a ping that never reaches the DB wouldn't stop the next
   * real request from hitting a cold start anyway.
   */
  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', time: new Date().toISOString() };
  }
}
