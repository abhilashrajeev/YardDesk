import { Module } from '@nestjs/common';
import { DayCloseService } from './dayclose.service';
import { DayCloseController } from './dayclose.controller';

@Module({
  providers: [DayCloseService],
  controllers: [DayCloseController],
})
export class DayCloseModule {}
