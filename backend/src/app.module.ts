import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, RolesGuard } from './auth/guards';
import { MaterialsModule } from './materials/materials.module';
import { CustomersModule } from './customers/customers.module';
import { VendorsModule } from './vendors/vendors.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MaterialsModule,
    CustomersModule,
    VendorsModule,
    VehiclesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then check role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
