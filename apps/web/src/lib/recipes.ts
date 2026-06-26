import { apiFetch } from "@/lib/api";
import { toNumber } from "@/lib/utils";
import type {
  MeasureUnit,
  ProductRecipeDetail,
  Recipe,
  RecipeCost,
  RecipeItem,
  RecipeSummary,
} from "@/lib/types";

/**
 * Recetas y costos. Contrato: docs/06-contratos-fase1b.md.
 * El costo se calcula server-side; el editor además lo recalcula en vivo
 * client-side para mostrar el impacto de cada cambio antes de guardar.
 */

function normalizeSummary(raw: unknown): RecipeSummary {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id),
    name: typeof r.name === "string" ? r.name : "",
    price: toNumber(r.price),
    categoryName:
      typeof r.categoryName === "string" && r.categoryName
        ? r.categoryName
        : null,
    hasRecipe: r.hasRecipe === true,
    active: r.active === true,
    unitCost: r.unitCost == null ? null : toNumber(r.unitCost),
    marginPercent: r.marginPercent == null ? null : toNumber(r.marginPercent),
  };
}

export interface RecipeListResult {
  data: RecipeSummary[];
  total: number;
}

export interface RecipeListParams {
  page: number;
  limit: number;
  search?: string;
}

export async function getRecipes(
  params: RecipeListParams,
): Promise<RecipeListResult> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search) query.set("search", params.search);

  const raw = await apiFetch<unknown>(`/recipes?${query.toString()}`);
  const res = raw as { data?: unknown[]; total?: unknown };
  if (Array.isArray(res?.data)) {
    return {
      data: res.data.map(normalizeSummary),
      total: typeof res.total === "number" ? res.total : res.data.length,
    };
  }
  const list = Array.isArray(raw) ? (raw as unknown[]) : [];
  return { data: list.map(normalizeSummary), total: list.length };
}

function normalizeItem(raw: unknown): RecipeItem {
  const i = raw as Record<string, unknown>;
  const rm = i.rawMaterial as Record<string, unknown> | null | undefined;
  return {
    id: typeof i.id === "string" ? i.id : undefined,
    rawMaterialId: String(i.rawMaterialId ?? rm?.id ?? ""),
    quantity: toNumber(i.quantity),
    wastePercent: toNumber(i.wastePercent),
    rawMaterial: rm
      ? {
          id: String(rm.id),
          name: typeof rm.name === "string" ? rm.name : "",
          unit: (rm.unit as MeasureUnit) ?? "UNIT",
          avgCost: toNumber(rm.avgCost),
        }
      : null,
  };
}

function normalizeRecipe(raw: unknown): Recipe {
  const r = raw as Record<string, unknown>;
  return {
    yieldQuantity: toNumber(r.yieldQuantity) || 1,
    active: r.active !== false,
    items: Array.isArray(r.items) ? r.items.map(normalizeItem) : [],
  };
}

function normalizeCost(raw: unknown): RecipeCost {
  const c = raw as Record<string, unknown>;
  return {
    ingredientsCost: toNumber(c.ingredientsCost),
    unitCost: toNumber(c.unitCost),
    price: toNumber(c.price),
    margin: toNumber(c.margin),
    marginPercent: c.marginPercent == null ? null : toNumber(c.marginPercent),
  };
}

export async function getProductRecipe(
  productId: string,
): Promise<ProductRecipeDetail> {
  const raw = await apiFetch<unknown>(
    `/products/${encodeURIComponent(productId)}/recipe`,
  );
  const res = raw as { recipe?: unknown; cost?: unknown };
  return {
    recipe: res?.recipe ? normalizeRecipe(res.recipe) : null,
    cost: res?.cost ? normalizeCost(res.cost) : null,
  };
}

export interface RecipePayload {
  yieldQuantity: number;
  active?: boolean;
  items: { rawMaterialId: string; quantity: number; wastePercent?: number }[];
}

export async function saveProductRecipe(
  productId: string,
  payload: RecipePayload,
): Promise<ProductRecipeDetail> {
  const raw = await apiFetch<unknown>(
    `/products/${encodeURIComponent(productId)}/recipe`,
    { method: "PUT", body: payload },
  );
  const res = raw as { recipe?: unknown; cost?: unknown };
  return {
    recipe: res?.recipe ? normalizeRecipe(res.recipe) : null,
    cost: res?.cost ? normalizeCost(res.cost) : null,
  };
}

export function deleteProductRecipe(productId: string): Promise<void> {
  return apiFetch<void>(`/products/${encodeURIComponent(productId)}/recipe`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Cálculo en vivo (espejo de la fórmula server-side del contrato)
// ---------------------------------------------------------------------------

/** Costo de una línea: quantity × (1 + merma/100) × avgCost. */
export function lineCost(
  quantity: number,
  wastePercent: number,
  avgCost: number,
): number {
  return quantity * (1 + wastePercent / 100) * avgCost;
}

export interface LiveCost {
  ingredientsCost: number;
  unitCost: number;
  margin: number;
  marginPercent: number | null;
}

export function computeLiveCost(
  items: { quantity: number; wastePercent: number; avgCost: number }[],
  yieldQuantity: number,
  price: number,
): LiveCost {
  const ingredientsCost = items.reduce(
    (acc, item) => acc + lineCost(item.quantity, item.wastePercent, item.avgCost),
    0,
  );
  const unitCost = yieldQuantity > 0 ? ingredientsCost / yieldQuantity : 0;
  const margin = price - unitCost;
  const marginPercent = price > 0 ? (margin / price) * 100 : null;
  return { ingredientsCost, unitCost, margin, marginPercent };
}
