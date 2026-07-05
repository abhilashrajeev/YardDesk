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
import { InventoryModule } from './inventory/inventory.module';
import { AccountsModule } from './accounts/accounts.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SalesModule } from './sales/sales.module';
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
    InventoryModule,
    AccountsModule,
    PurchasesModule,
    SalesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then check role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
