import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, RolesGuard, PermissionsGuard } from './auth/guards';
import { MaterialsModule } from './materials/materials.module';
import { CustomersModule } from './customers/customers.module';
import { VendorsModule } from './vendors/vendors.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { InventoryModule } from './inventory/inventory.module';
import { AccountsModule } from './accounts/accounts.module';
import { PurchasesModule } from './purchases/purchases.module';
import { SalesModule } from './sales/sales.module';
import { DayCloseModule } from './dayclose/dayclose.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { ExpensesModule } from './expenses/expenses.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
    DayCloseModule,
    ReportsModule,
    NotificationsModule,
    AuditModule,
    ExpensesModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate, then role, then fine-grained permission.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
