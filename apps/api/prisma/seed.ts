/* eslint-disable no-console */
import { MeasureUnit, PrismaClient, StockLinkMode, TableShape } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================================
// 1. Catálogo de permisos
// ============================================================
type PermissionDef = { code: string; module: string; description: string };

const PERMISSIONS: PermissionDef[] = [
  // dashboard
  { code: 'dashboard.view', module: 'dashboard', description: 'Ver dashboard' },
  // products
  { code: 'products.view', module: 'products', description: 'Ver productos y categorías' },
  { code: 'products.create', module: 'products', description: 'Crear productos y categorías' },
  { code: 'products.update', module: 'products', description: 'Editar productos y categorías' },
  { code: 'products.delete', module: 'products', description: 'Eliminar productos y categorías' },
  { code: 'recipes.update', module: 'products', description: 'Editar recetas de productos' },
  { code: 'costs.view', module: 'products', description: 'Ver costos' },
  { code: 'costs.update', module: 'products', description: 'Actualizar costos' },
  // stock
  { code: 'stock.view', module: 'stock', description: 'Ver stock (materia prima y platos)' },
  { code: 'stock.create', module: 'stock', description: 'Crear materias primas' },
  { code: 'stock.update', module: 'stock', description: 'Editar materias primas' },
  { code: 'stock.delete', module: 'stock', description: 'Eliminar materias primas' },
  { code: 'stock.adjust', module: 'stock', description: 'Ajustar stock manualmente' },
  { code: 'stock.transfer', module: 'stock', description: 'Transferir stock entre depósitos' },
  // production
  { code: 'production.view', module: 'production', description: 'Ver órdenes de producción' },
  { code: 'production.create', module: 'production', description: 'Cargar producción' },
  // purchases
  { code: 'purchases.view', module: 'purchases', description: 'Ver órdenes de compra' },
  { code: 'purchases.create', module: 'purchases', description: 'Crear órdenes de compra' },
  { code: 'purchases.update', module: 'purchases', description: 'Editar órdenes de compra' },
  { code: 'purchases.receive', module: 'purchases', description: 'Recibir mercadería' },
  { code: 'purchases.cancel', module: 'purchases', description: 'Cancelar órdenes de compra' },
  // suppliers
  { code: 'suppliers.view', module: 'suppliers', description: 'Ver proveedores' },
  { code: 'suppliers.create', module: 'suppliers', description: 'Crear proveedores' },
  { code: 'suppliers.update', module: 'suppliers', description: 'Editar proveedores' },
  { code: 'suppliers.delete', module: 'suppliers', description: 'Eliminar proveedores' },
  // sales
  { code: 'sales.view', module: 'sales', description: 'Ver ventas y pedidos' },
  { code: 'sales.create', module: 'sales', description: 'Crear pedidos / vender' },
  { code: 'sales.update', module: 'sales', description: 'Editar pedidos' },
  { code: 'sales.cancel', module: 'sales', description: 'Cancelar ventas' },
  { code: 'sales.discount', module: 'sales', description: 'Aplicar descuentos' },
  // cash
  { code: 'cash.view', module: 'cash', description: 'Ver caja' },
  { code: 'cash.open', module: 'cash', description: 'Abrir caja' },
  { code: 'cash.close', module: 'cash', description: 'Cerrar caja (arqueo)' },
  { code: 'cash.movement', module: 'cash', description: 'Registrar retiros/ingresos de caja' },
  { code: 'cash.manage', module: 'cash', description: 'Administrar caja (movimientos)' },
  // kitchen (KDS)
  { code: 'kitchen.view', module: 'kitchen', description: 'Ver comandas de cocina (KDS)' },
  { code: 'kitchen.update', module: 'kitchen', description: 'Actualizar estado de comandas' },
  // tables
  { code: 'tables.view', module: 'tables', description: 'Ver mapa de mesas' },
  { code: 'tables.update', module: 'tables', description: 'Crear/editar áreas, mesas y layout' },
  { code: 'tables.manage', module: 'tables', description: 'Operar mesas (abrir, unir, mover)' },
  { code: 'tables.layout', module: 'tables', description: 'Editar layout del salón' },
  // reservations
  { code: 'reservations.view', module: 'reservations', description: 'Ver reservas' },
  { code: 'reservations.create', module: 'reservations', description: 'Crear reservas' },
  { code: 'reservations.update', module: 'reservations', description: 'Editar reservas' },
  { code: 'reservations.cancel', module: 'reservations', description: 'Cancelar reservas' },
  // customers
  { code: 'customers.view', module: 'customers', description: 'Ver clientes' },
  { code: 'customers.create', module: 'customers', description: 'Crear clientes' },
  { code: 'customers.update', module: 'customers', description: 'Editar clientes' },
  { code: 'customers.delete', module: 'customers', description: 'Eliminar clientes' },
  // users
  { code: 'users.view', module: 'users', description: 'Ver usuarios' },
  { code: 'users.create', module: 'users', description: 'Crear usuarios' },
  { code: 'users.update', module: 'users', description: 'Editar usuarios y sus roles' },
  { code: 'users.delete', module: 'users', description: 'Eliminar usuarios' },
  // roles
  { code: 'roles.view', module: 'roles', description: 'Ver roles' },
  { code: 'roles.create', module: 'roles', description: 'Crear roles personalizados' },
  { code: 'roles.update', module: 'roles', description: 'Editar roles personalizados' },
  { code: 'roles.delete', module: 'roles', description: 'Eliminar roles personalizados' },
  // branches
  { code: 'branches.view', module: 'branches', description: 'Ver sucursales' },
  { code: 'branches.create', module: 'branches', description: 'Crear sucursales' },
  { code: 'branches.update', module: 'branches', description: 'Editar sucursales' },
  { code: 'branches.delete', module: 'branches', description: 'Eliminar sucursales' },
  // settings
  { code: 'settings.view', module: 'settings', description: 'Ver configuración' },
  { code: 'settings.manage', module: 'settings', description: 'Administrar configuración y plan' },
  // reports
  { code: 'reports.view', module: 'reports', description: 'Ver reportes' },
  { code: 'reports.export', module: 'reports', description: 'Exportar reportes' },
  // invoices
  { code: 'invoices.view', module: 'invoices', description: 'Ver facturas' },
  { code: 'invoices.create', module: 'invoices', description: 'Emitir facturas' },
  { code: 'invoices.cancel', module: 'invoices', description: 'Anular facturas (NC)' },
];

const ALL = PERMISSIONS.map((p) => p.code);
const except = (...codes: string[]) => ALL.filter((c) => !codes.includes(c));

// ============================================================
// 2. Roles de sistema
// ============================================================
const SYSTEM_ROLES: { code: string; name: string; permissions: string[] }[] = [
  { code: 'owner', name: 'Dueño', permissions: ALL },
  { code: 'admin', name: 'Administrador', permissions: except('settings.manage') },
  {
    code: 'manager',
    name: 'Gerente',
    permissions: except(
      'settings.manage',
      'roles.create',
      'roles.update',
      'roles.delete',
      'branches.create',
      'branches.delete',
      'users.delete',
    ),
  },
  {
    code: 'supervisor',
    name: 'Supervisor',
    permissions: [
      'dashboard.view',
      'products.view',
      'products.update',
      'stock.view',
      'stock.adjust',
      'production.view',
      'production.create',
      'sales.view',
      'sales.create',
      'sales.update',
      'sales.cancel',
      'sales.discount',
      'cash.view',
      'cash.open',
      'cash.close',
      'cash.movement',
      'cash.manage',
      'kitchen.view',
      'kitchen.update',
      'tables.view',
      'tables.manage',
      'tables.update',
      'reservations.view',
      'reservations.create',
      'reservations.update',
      'reservations.cancel',
      'customers.view',
      'customers.create',
      'customers.update',
      'users.view',
      'reports.view',
      'invoices.view',
      'invoices.create',
    ],
  },
  {
    code: 'shift_lead',
    name: 'Encargado',
    permissions: [
      'dashboard.view',
      'products.view',
      'recipes.update',
      'costs.view',
      'stock.view',
      'stock.adjust',
      'production.view',
      'production.create',
      'sales.view',
      'sales.create',
      'sales.update',
      'sales.discount',
      'cash.view',
      'cash.open',
      'cash.close',
      'cash.movement',
      'cash.manage',
      'kitchen.view',
      'kitchen.update',
      'tables.view',
      'tables.manage',
      'tables.update',
      'reservations.view',
      'reservations.create',
      'reservations.update',
      'customers.view',
      'customers.create',
    ],
  },
  {
    code: 'cashier',
    name: 'Cajero',
    permissions: [
      'dashboard.view',
      'products.view',
      'sales.view',
      'sales.create',
      'sales.update',
      'sales.cancel',
      'cash.view',
      'cash.open',
      'cash.close',
      'cash.movement',
      'cash.manage',
      'customers.view',
      'customers.create',
      'customers.update',
      'customers.delete',
      'invoices.view',
      'invoices.create',
    ],
  },
  {
    code: 'waiter',
    name: 'Mozo',
    permissions: [
      'products.view',
      'sales.view',
      'sales.create',
      'sales.update',
      'tables.view',
      'tables.manage',
      'kitchen.view',
      'reservations.view',
      'reservations.create',
      'reservations.update',
      'customers.view',
      'customers.create',
    ],
  },
  {
    code: 'helper',
    name: 'Ayudante',
    permissions: ['products.view', 'tables.view', 'sales.view'],
  },
  {
    code: 'kitchen',
    name: 'Cocina',
    permissions: [
      'products.view',
      'stock.view',
      'stock.adjust',
      'production.view',
      'production.create',
      'sales.view',
      'kitchen.view',
      'kitchen.update',
    ],
  },
  {
    code: 'bartender',
    name: 'Bartender',
    permissions: [
      'products.view',
      'stock.view',
      'production.view',
      'production.create',
      'sales.view',
      'sales.create',
      'tables.view',
      'kitchen.view',
      'kitchen.update',
    ],
  },
  {
    code: 'purchasing',
    name: 'Compras',
    permissions: [
      'dashboard.view',
      'stock.view',
      'costs.view',
      'costs.update',
      'purchases.view',
      'purchases.create',
      'purchases.update',
      'purchases.receive',
      'purchases.cancel',
      'suppliers.view',
      'suppliers.create',
      'suppliers.update',
      'suppliers.delete',
      'reports.view',
    ],
  },
  {
    code: 'warehouse',
    name: 'Depósito',
    permissions: [
      'stock.view',
      'stock.create',
      'stock.update',
      'stock.adjust',
      'stock.transfer',
      'purchases.view',
      'purchases.create',
      'purchases.update',
      'purchases.receive',
      'purchases.cancel',
    ],
  },
  {
    code: 'accountant',
    name: 'Contador',
    permissions: [
      'dashboard.view',
      'sales.view',
      'cash.view',
      'costs.view',
      'purchases.view',
      'reports.view',
      'reports.export',
      'invoices.view',
      'invoices.create',
      'invoices.cancel',
    ],
  },
  {
    code: 'courier',
    name: 'Repartidor',
    permissions: ['sales.view', 'customers.view'],
  },
];

async function seedPermissions(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, description: p.description },
      create: p,
    });
    ids.set(row.code, row.id);
  }
  console.log(`Permisos: ${ids.size}`);
  return ids;
}

async function seedSystemRoles(permissionIds: Map<string, string>): Promise<Map<string, string>> {
  const roleIds = new Map<string, string>();
  for (const def of SYSTEM_ROLES) {
    let role = await prisma.role.findFirst({
      where: { tenantId: null, isSystem: true, code: def.code },
    });
    if (!role) {
      role = await prisma.role.create({
        data: { tenantId: null, name: def.name, code: def.code, isSystem: true },
      });
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: def.permissions.map((code) => {
        const permissionId = permissionIds.get(code);
        if (!permissionId) {
          throw new Error(`Permiso desconocido en rol ${def.code}: ${code}`);
        }
        return { roleId: role!.id, permissionId };
      }),
    });
    roleIds.set(def.code, role.id);
  }
  console.log(`Roles de sistema: ${roleIds.size}`);
  return roleIds;
}

// ============================================================
// 3. Tenant demo
// ============================================================
async function seedDemoTenant(roleIds: Map<string, string>): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Resto',
      slug: 'demo',
      settings: { currency: 'ARS', country: 'AR' },
    },
  });

  let branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, name: 'Casa Central' },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Casa Central',
        address: 'Av. Corrientes 1234, CABA',
        phone: '+54 11 4000-0000',
      },
    });
  }

  let warehouse = await prisma.warehouse.findFirst({
    where: { branchId: branch.id, isDefault: true },
  });
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: { branchId: branch.id, name: 'Depósito principal', isDefault: true },
    });
  }

  const cashRegister = await prisma.cashRegister.findFirst({ where: { branchId: branch.id } });
  if (!cashRegister) {
    await prisma.cashRegister.create({ data: { branchId: branch.id, name: 'Caja principal' } });
  }

  // Usuario admin
  const ownerRoleId = roleIds.get('owner');
  if (!ownerRoleId) {
    throw new Error('Rol owner no encontrado');
  }
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Demo',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: ownerRoleId } },
    update: {},
    create: { userId: admin.id, roleId: ownerRoleId },
  });
  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: admin.id, branchId: branch.id } },
    update: {},
    create: { userId: admin.id, branchId: branch.id },
  });

  // Categorías con estación por defecto.
  // Bebidas → Barra y por defecto sin preparación (heladera);
  // el resto → Cocina con preparación.
  const categoryDefs: {
    name: string;
    defaultStation: string;
    defaultRequiresPreparation: boolean;
  }[] = [
    { name: 'Entradas', defaultStation: 'Cocina', defaultRequiresPreparation: true },
    { name: 'Platos principales', defaultStation: 'Cocina', defaultRequiresPreparation: true },
    { name: 'Postres', defaultStation: 'Cocina', defaultRequiresPreparation: true },
    { name: 'Bebidas', defaultStation: 'Barra', defaultRequiresPreparation: false },
  ];
  const categories = new Map<string, string>();
  for (const [i, def] of categoryDefs.entries()) {
    let category = await prisma.category.findFirst({
      where: { tenantId: tenant.id, name: def.name },
    });
    if (!category) {
      category = await prisma.category.create({
        data: {
          tenantId: tenant.id,
          name: def.name,
          sortOrder: i,
          defaultStation: def.defaultStation,
          defaultRequiresPreparation: def.defaultRequiresPreparation,
        },
      });
    } else {
      category = await prisma.category.update({
        where: { id: category.id },
        data: {
          defaultStation: def.defaultStation,
          defaultRequiresPreparation: def.defaultRequiresPreparation,
        },
      });
    }
    categories.set(def.name, category.id);
  }

  // Productos. printStation/requiresPreparation se heredan de la
  // categoría salvo override explícito:
  //  - Coca/Agua: requiresPreparation=false (heladera, no pasa por KDS).
  //  - Cerveza artesanal pinta: Barra + requiresPreparation=true (se sirve de canilla).
  const products: {
    name: string;
    sku: string;
    category: string;
    price: number;
    trackStock?: boolean;
    stockLinkMode?: StockLinkMode;
    printStation?: string;
    requiresPreparation?: boolean;
  }[] = [
    { name: 'Rabas', sku: 'ENT-RABAS', category: 'Entradas', price: 12500, trackStock: true },
    { name: 'Empanadas de carne (docena)', sku: 'ENT-EMP-CARNE', category: 'Entradas', price: 9600, trackStock: true },
    { name: 'Provoleta', sku: 'ENT-PROVO', category: 'Entradas', price: 7800 },
    { name: 'Milanesa napolitana con papas', sku: 'PRI-MILA-NAPO', category: 'Platos principales', price: 14500, trackStock: true },
    { name: 'Bife de chorizo', sku: 'PRI-BIFE', category: 'Platos principales', price: 18900 },
    { name: 'Ñoquis con salsa bolognesa', sku: 'PRI-NOQUIS', category: 'Platos principales', price: 11200 },
    { name: 'Flan casero con dulce de leche', sku: 'POS-FLAN', category: 'Postres', price: 5400, trackStock: true },
    { name: 'Queso y dulce (vigilante)', sku: 'POS-VIGILANTE', category: 'Postres', price: 4800 },
    { name: 'Coca-Cola 500ml', sku: 'BEB-COCA-500', category: 'Bebidas', price: 2800, stockLinkMode: StockLinkMode.INDEPENDENT, trackStock: true, requiresPreparation: false },
    { name: 'Agua mineral 500ml', sku: 'BEB-AGUA-500', category: 'Bebidas', price: 2200, stockLinkMode: StockLinkMode.INDEPENDENT, trackStock: true, requiresPreparation: false },
    { name: 'Cerveza artesanal pinta', sku: 'BEB-IPA-PINTA', category: 'Bebidas', price: 4500, printStation: 'Barra', requiresPreparation: true },
  ];
  const productIds = new Map<string, string>();
  for (const p of products) {
    const cat = categoryDefs.find((c) => c.name === p.category);
    // Snapshot efectivo (hereda de la categoría si no hay override).
    const printStation = p.printStation ?? cat?.defaultStation ?? null;
    const requiresPreparation =
      p.requiresPreparation ?? cat?.defaultRequiresPreparation ?? true;
    const product = await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: p.sku } },
      update: { price: p.price, printStation, requiresPreparation },
      create: {
        tenantId: tenant.id,
        name: p.name,
        sku: p.sku,
        categoryId: categories.get(p.category),
        price: p.price,
        trackStock: p.trackStock ?? false,
        stockLinkMode: p.stockLinkMode ?? StockLinkMode.INHERIT,
        printStation,
        requiresPreparation,
      },
    });
    productIds.set(p.sku, product.id);
  }

  // Materias primas
  const rawMaterials: { name: string; sku: string; unit: MeasureUnit; category: string }[] = [
    { name: 'Calamar', sku: 'MP-CALAMAR', unit: MeasureUnit.KG, category: 'pescados' },
    { name: 'Carne de nalga', sku: 'MP-NALGA', unit: MeasureUnit.KG, category: 'carnes' },
    { name: 'Papas', sku: 'MP-PAPA', unit: MeasureUnit.KG, category: 'verduras' },
    { name: 'Queso muzzarella', sku: 'MP-MUZZA', unit: MeasureUnit.KG, category: 'lácteos' },
    { name: 'Harina 000', sku: 'MP-HARINA', unit: MeasureUnit.KG, category: 'almacén' },
    { name: 'Aceite de girasol', sku: 'MP-ACEITE', unit: MeasureUnit.L, category: 'almacén' },
    { name: 'Huevos', sku: 'MP-HUEVO', unit: MeasureUnit.UNIT, category: 'almacén' },
    { name: 'Salsa de tomate', sku: 'MP-TOMATE', unit: MeasureUnit.L, category: 'almacén' },
  ];
  const rawMaterialIds = new Map<string, string>();
  for (const rm of rawMaterials) {
    const row = await prisma.rawMaterial.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: rm.sku } },
      update: {},
      create: { tenantId: tenant.id, ...rm },
    });
    rawMaterialIds.set(rm.sku, row.id);
  }

  // Receta de ejemplo: Rabas => 0.2 kg de calamar por porción
  const rabasId = productIds.get('ENT-RABAS');
  const calamarId = rawMaterialIds.get('MP-CALAMAR');
  if (rabasId && calamarId) {
    const recipe = await prisma.recipe.upsert({
      where: { productId: rabasId },
      update: {},
      create: { productId: rabasId, yieldQuantity: 1 },
    });
    const existingItem = await prisma.recipeItem.findFirst({
      where: { recipeId: recipe.id, rawMaterialId: calamarId },
    });
    if (!existingItem) {
      await prisma.recipeItem.create({
        data: { recipeId: recipe.id, rawMaterialId: calamarId, quantity: 0.2 },
      });
    }
  }

  // Áreas y mesas con layout x/y
  const seedTables = async (
    areaName: string,
    sortOrder: number,
    tables: { name: string; x: number; y: number; capacity?: number; shape?: TableShape }[],
  ) => {
    let area = await prisma.area.findFirst({
      where: { branchId: branch!.id, name: areaName },
    });
    if (!area) {
      area = await prisma.area.create({
        data: { branchId: branch!.id, name: areaName, sortOrder },
      });
    }
    for (const t of tables) {
      const exists = await prisma.diningTable.findFirst({
        where: { areaId: area.id, name: t.name },
      });
      if (!exists) {
        await prisma.diningTable.create({
          data: {
            areaId: area.id,
            name: t.name,
            x: t.x,
            y: t.y,
            capacity: t.capacity ?? 4,
            shape: t.shape ?? TableShape.SQUARE,
          },
        });
      }
    }
  };

  await seedTables('Salón principal', 0, [
    { name: 'Mesa 1', x: 40, y: 40 },
    { name: 'Mesa 2', x: 180, y: 40 },
    { name: 'Mesa 3', x: 320, y: 40 },
    { name: 'Mesa 4', x: 40, y: 180, capacity: 2, shape: TableShape.ROUND },
    { name: 'Mesa 5', x: 180, y: 180, capacity: 6, shape: TableShape.RECTANGLE },
    { name: 'Mesa 6', x: 320, y: 180 },
  ]);
  await seedTables('Patio', 1, [
    { name: 'Patio 1', x: 60, y: 60, shape: TableShape.ROUND },
    { name: 'Patio 2', x: 200, y: 60, shape: TableShape.ROUND },
    { name: 'Patio 3', x: 340, y: 60, capacity: 8, shape: TableShape.RECTANGLE },
  ]);

  console.log('Tenant demo listo: admin@demo.com / Admin123! (slug: demo)');
}

async function main(): Promise<void> {
  const permissionIds = await seedPermissions();
  const roleIds = await seedSystemRoles(permissionIds);
  await seedDemoTenant(roleIds);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
