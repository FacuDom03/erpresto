export interface Branch {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  tenantId?: string;
  /** Sucursales asignadas (el backend puede devolver una u otra forma). */
  branchIds?: string[];
  branches?: Branch[];
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  sortOrder?: number;
  parentId?: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  description?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Salón (áreas y mesas)
// ---------------------------------------------------------------------------

export type TableShape =
  | "ROUND"
  | "SQUARE"
  | "RECTANGLE"
  | "BOX"
  | "BAR"
  | "DECOR";

export type TableStatus =
  | "FREE"
  | "RESERVED"
  | "OCCUPIED"
  | "WAITING_KITCHEN"
  | "WAITING_BILL"
  | "OUT_OF_SERVICE";

export interface DiningTable {
  id: string;
  areaId: string;
  name: string;
  shape: TableShape;
  status: TableStatus;
  capacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color?: string | null;
  /** Si está unida a otra mesa, id de la mesa "principal". */
  mergedIntoId?: string | null;
}

export interface Area {
  id: string;
  branchId: string;
  name: string;
  sortOrder?: number;
  tables: DiningTable[];
}

// ---------------------------------------------------------------------------
// Pedidos (POS)
// ---------------------------------------------------------------------------

export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "COUNTER";
export type OrderStatus = "OPEN" | "CLOSED" | "CANCELLED";
export type OrderItemStatus =
  | "PENDING"
  | "SENT"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentMethod =
  | "CASH"
  | "CARD_DEBIT"
  | "CARD_CREDIT"
  | "QR"
  | "MERCADOPAGO"
  | "TRANSFER";

export interface OrderItem {
  id: string;
  productId: string;
  product?: { id: string; name: string } | null;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  status: OrderItemStatus;
  station?: string | null;
  sentAt?: string | null;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string | null;
  createdAt?: string;
}

export interface Order {
  id: string;
  number?: number;
  type: OrderType;
  status: OrderStatus;
  tableId?: string | null;
  table?: { id: string; name: string } | null;
  waiterId?: string | null;
  waiter?: { id: string; name?: string | null } | null;
  peopleCount?: number | null;
  subtotal: number;
  discount: number;
  tip: number;
  total: number;
  notes?: string | null;
  createdAt?: string;
  closedAt?: string | null;
  items: OrderItem[];
  payments: Payment[];
}

// ---------------------------------------------------------------------------
// Cocina (KDS)
// ---------------------------------------------------------------------------

export interface KitchenItem {
  id: string;
  status: OrderItemStatus;
  quantity: number;
  notes?: string | null;
  product: { name: string };
  station?: string | null;
  sentAt: string;
  order: {
    id: string;
    number?: number;
    type: OrderType;
    table?: { name: string } | null;
  };
}

// ---------------------------------------------------------------------------
// Caja
// ---------------------------------------------------------------------------

export type CashMovementType = "WITHDRAWAL" | "DEPOSIT" | "EXPENSE" | "TIP";

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  notes?: string | null;
  createdAt?: string;
}

export interface CashSession {
  id: string;
  registerId: string;
  status: "OPEN" | "CLOSED";
  openingAmount: number;
  closingAmount?: number | null;
  expectedAmount?: number | null;
  difference?: number | null;
  openedAt?: string;
  closedAt?: string | null;
  /** Resumen de ventas por método (solo en el detalle GET /cash/sessions/:id). */
  salesByMethod?: Partial<Record<PaymentMethod, number>>;
  movements?: CashMovement[];
}

export interface CashRegister {
  id: string;
  branchId: string;
  name: string;
  currentSession?: CashSession | null;
}

// ---------------------------------------------------------------------------
// Stock: materia prima y depósitos
// ---------------------------------------------------------------------------

export type MeasureUnit = "UNIT" | "KG" | "G" | "L" | "ML" | "PACK";

export interface WarehouseStock {
  warehouseId: string;
  warehouseName: string | null;
  branchId: string | null;
  quantity: number;
}

export interface RawMaterial {
  id: string;
  name: string;
  sku?: string | null;
  unit: MeasureUnit;
  category?: string | null;
  minStock: number | null;
  avgCost: number;
  lastCost: number;
  totalStock: number;
  stockByWarehouse: WarehouseStock[];
  active?: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  isDefault?: boolean;
  active?: boolean;
}

/** Tipos de ajuste manual de materia prima. */
export type RawAdjustType = "ADJUSTMENT" | "WASTE" | "INVENTORY";

// ---------------------------------------------------------------------------
// Stock de producción (platos)
// ---------------------------------------------------------------------------

export interface ProductStockEntry {
  productId: string;
  branchId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    sku?: string | null;
    minStock: number | null;
  };
}

/** Tipos de ajuste manual del stock de platos. */
export type ProductAdjustType = "MANUAL" | "ADJUSTMENT" | "WASTE";

// ---------------------------------------------------------------------------
// Recetas y costos
// ---------------------------------------------------------------------------

/** Fila de GET /recipes: producto con resumen de costo. */
export interface RecipeSummary {
  /** id del producto. */
  id: string;
  name: string;
  price: number;
  categoryName: string | null;
  hasRecipe: boolean;
  /** true si la receta está activa (false también cuando no hay receta). */
  active: boolean;
  unitCost: number | null;
  marginPercent: number | null;
}

export interface RecipeItem {
  id?: string;
  rawMaterialId: string;
  quantity: number;
  wastePercent: number;
  rawMaterial?: {
    id: string;
    name: string;
    unit: MeasureUnit;
    avgCost: number;
  } | null;
}

export interface Recipe {
  yieldQuantity: number;
  active: boolean;
  items: RecipeItem[];
}

export interface RecipeCost {
  ingredientsCost: number;
  unitCost: number;
  price: number;
  margin: number;
  marginPercent: number | null;
}

export interface ProductRecipeDetail {
  recipe: Recipe | null;
  cost: RecipeCost | null;
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

export interface Supplier {
  id: string;
  name: string;
  cuit?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  deliveryDays?: number | null;
  /** Calificación 1-5. */
  rating?: number | null;
  notes?: string | null;
  active: boolean;
}
