import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/decorators';
import { todayIST } from '../common/date';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function d(val: string | undefined, fallback: string): string {
  const date = val ?? fallback;
  if (!DATE_RE.test(date)) throw new BadRequestException('dates must be YYYY-MM-DD');
  return date;
}

@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  /** Daily report — defaults to today (IST). */
  @Get('daily')
  daily(@Query('date') date?: string) {
    const day = d(date, todayIST());
    return this.reports.summary(day, day);
  }

  /** Totals for any range (use for monthly/yearly by passing from/to). */
  @Get('summary')
  summary(@Query('from') from: string, @Query('to') to: string) {
    const today = todayIST();
    return this.reports.summary(d(from, today), d(to, today));
  }

  @Get('materials')
  materials(@Query('from') from: string, @Query('to') to: string) {
    const today = todayIST();
    return this.reports.materialBreakdown(d(from, today), d(to, today));
  }

  @Get('series')
  series(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('granularity') granularity?: string,
  ) {
    const today = todayIST();
    const g = granularity === 'month' ? 'month' : 'day';
    return this.reports.series(d(from, today), d(to, today), g);
  }
}
