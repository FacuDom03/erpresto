import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { CashModule } from './cash/cash.module';
import { CategoriesModule } from './categories/categories.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductStockModule } from './product-stock/product-stock.module';
import { ProductsModule } from './products/products.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { RawMaterialsModule } from './raw-materials/raw-materials.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RecipesModule } from './recipes/recipes.module';
import { ReservationsModule } from './reservations/reservations.module';
import { RolesModule } from './roles/roles.module';
import { SalonModule } from './salon/salon.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    PrismaModule,
    RealtimeModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    BranchesModule,
    UsersModule,
    RolesModule,
    CategoriesModule,
    ProductsModule,
    RecipesModule,
    RawMaterialsModule,
    SuppliersModule,
    ProductStockModule,
    SalonModule,
    OrdersModule,
    KitchenModule,
    CashModule,
    PurchaseOrdersModule,
    DashboardModule,
    CustomersModule,
    ReservationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
