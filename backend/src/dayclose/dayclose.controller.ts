import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DayCloseService } from './dayclose.service';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { todayIST } from '../common/date';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(d?: string): string {
  const date = d ?? todayIST();
  if (!DATE_RE.test(date)) throw new BadRequestException('date must be YYYY-MM-DD');
  return date;
}

@Controller('day-close')
export class DayCloseController {
  constructor(private dayClose: DayCloseService) {}

  /** Live preview (unsaved) of the day's stock movement. */
  @Get('preview')
  preview(@Query('date') date?: string) {
    return this.dayClose.compute(validDate(date));
  }

  /** The locked snapshot for a date. */
  @Get()
  get(@Query('date') date?: string) {
    return this.dayClose.getByDate(validDate(date));
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  close(@CurrentUser() user: AuthUser, @Body('date') date?: string) {
    return this.dayClose.close(validDate(date), user.userId);
  }
}
