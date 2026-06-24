import { apiFetch } from "@/lib/api";
import type { Category, Product } from "@/lib/types";

/**
 * Shape ASUMIDO de la respuesta paginada del backend:
 *   GET /products?page=&limit=&search=&categoryId= → { data: Product[], total: number }
 *
 * Si el backend devuelve otro formato (por ej. { items, meta: { total } }),
 * ajustar SOLO la función `normalizeProductList` de este archivo.
 */
export interface ProductListResult {
  data: Product[];
  total: number;
}

function normalizeProductList(raw: unknown): ProductListResult {
  // El backend de productos devuelve { items, meta: { total } }; otros
  // módulos devuelven { data, total }. Aceptamos ambas formas (y un
  // array plano) para no depender de un único contrato.
  const res = raw as {
    data?: Product[];
    items?: Product[];
    total?: number;
    meta?: { total?: number };
  };
  const list = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.items)
      ? res.items
      : Array.isArray(raw)
        ? (raw as Product[])
        : [];
  const total =
    typeof res?.total === "number"
      ? res.total
      : typeof res?.meta?.total === "number"
        ? res.meta.total
        : list.length;
  return { data: list, total };
}

export interface ProductListParams {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
}

export async function getProducts(
  params: ProductListParams,
): Promise<ProductListResult> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search) query.set("search", params.search);
  if (params.categoryId) query.set("categoryId", params.categoryId);

  const raw = await apiFetch<unknown>(`/products?${query.toString()}`);
  return normalizeProductList(raw);
}

export function getProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/products/${encodeURIComponent(id)}`);
}

export interface ProductPayload {
  name: string;
  sku: string;
  price: number;
  categoryId?: string | null;
  description?: string | null;
}

export function createProduct(payload: ProductPayload): Promise<Product> {
  return apiFetch<Product>("/products", { method: "POST", body: payload });
}

export function updateProduct(
  id: string,
  payload: Partial<ProductPayload>,
): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteProduct(id: string): Promise<void> {
  return apiFetch<void>(`/products/${id}`, { method: "DELETE" });
}

export function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/categories");
}
