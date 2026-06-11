"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ServerOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { getProduct } from "@/lib/products";
import { getAllRawMaterials, UNIT_SHORT } from "@/lib/raw-materials";
import {
  computeLiveCost,
  deleteProductRecipe,
  getProductRecipe,
  lineCost,
  saveProductRecipe,
  type RecipePayload,
} from "@/lib/recipes";
import { cn, formatARS, parseDecimal, toNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const percentFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
});

function marginColor(marginPercent: number): string {
  if (marginPercent > 60) return "text-success";
  if (marginPercent >= 30) return "text-warning";
  return "text-destructive";
}

interface ItemRow {
  key: number;
  rawMaterialId: string | null;
  quantityInput: string;
  wasteInput: string;
}

let nextItemKey = 1;

function emptyItem(): ItemRow {
  return { key: nextItemKey++, rawMaterialId: null, quantityInput: "", wasteInput: "" };
}

export default function RecetaEditorPage() {
  const params = useParams<{ productId: string }>();
  const productId = params.productId;
  const router = useRouter();
  const queryClient = useQueryClient();

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProduct(productId),
  });

  const recipeQuery = useQuery({
    queryKey: ["recipe", productId],
    queryFn: () => getProductRecipe(productId),
  });

  const rawMaterialsQuery = useQuery({
    queryKey: ["raw-materials", "all"],
    queryFn: getAllRawMaterials,
    staleTime: 60_000,
  });

  const [yieldInput, setYieldInput] = useState("1");
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [initialized, setInitialized] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Carga inicial del formulario desde la receta guardada (una sola vez).
  useEffect(() => {
    if (initialized || !recipeQuery.data) return;
    const recipe = recipeQuery.data.recipe;
    if (recipe) {
      setYieldInput(String(recipe.yieldQuantity));
      setActive(recipe.active);
      setItems(
        recipe.items.length > 0
          ? recipe.items.map((item) => ({
              key: nextItemKey++,
              rawMaterialId: item.rawMaterialId,
              quantityInput: String(item.quantity),
              wasteInput: item.wastePercent ? String(item.wastePercent) : "",
            }))
          : [emptyItem()],
      );
    }
    setInitialized(true);
  }, [initialized, recipeQuery.data]);

  const rawMaterials = useMemo(
    () => rawMaterialsQuery.data ?? [],
    [rawMaterialsQuery.data],
  );
  const rawMaterialById = useMemo(
    () => new Map(rawMaterials.map((m) => [m.id, m])),
    [rawMaterials],
  );
  const rawMaterialOptions = useMemo(
    () =>
      rawMaterials.map((m) => ({
        value: m.id,
        label: m.name,
        description: `${UNIT_SHORT[m.unit]} · costo prom. ${formatARS(m.avgCost)}`,
      })),
    [rawMaterials],
  );

  const product = productQuery.data;
  const price = toNumber(product?.price);
  const hasRecipe = recipeQuery.data?.recipe != null;

  // ------------------------------------------------------------------
  // Cálculo en vivo
  // ------------------------------------------------------------------
  const yieldQuantity = parseDecimal(yieldInput) ?? 0;

  const computedItems = items.map((item) => {
    const material = item.rawMaterialId
      ? rawMaterialById.get(item.rawMaterialId)
      : undefined;
    const quantity = parseDecimal(item.quantityInput) ?? 0;
    const wastePercent = parseDecimal(item.wasteInput) ?? 0;
    const avgCost = material?.avgCost ?? 0;
    return {
      ...item,
      material,
      quantity,
      wastePercent,
      cost: material ? lineCost(quantity, wastePercent, avgCost) : 0,
    };
  });

  const live = computeLiveCost(
    computedItems
      .filter((item) => item.material)
      .map((item) => ({
        quantity: item.quantity,
        wastePercent: item.wastePercent,
        avgCost: item.material?.avgCost ?? 0,
      })),
    yieldQuantity,
    price,
  );

  const validItems = computedItems.filter(
    (item) => item.rawMaterialId !== null && item.quantity > 0,
  );
  const canSave = yieldQuantity > 0 && validItems.length > 0;

  // ------------------------------------------------------------------
  // Mutaciones
  // ------------------------------------------------------------------
  const saveMutation = useMutation({
    mutationFn: (payload: RecipePayload) =>
      saveProductRecipe(productId, payload),
    onSuccess: (detail) => {
      queryClient.setQueryData(["recipe", productId], detail);
      void queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Receta guardada");
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo guardar la receta",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProductRecipe(productId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recipes"] });
      void queryClient.invalidateQueries({ queryKey: ["recipe", productId] });
      toast.success("Receta eliminada");
      router.push("/recetas");
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo eliminar la receta",
      );
      setDeleteOpen(false);
    },
  });

  const save = () => {
    if (!canSave) return;
    saveMutation.mutate({
      yieldQuantity,
      active,
      items: validItems.map((item) => ({
        rawMaterialId: item.rawMaterialId as string,
        quantity: item.quantity,
        wastePercent: item.wastePercent,
      })),
    });
  };

  const updateItem = (key: number, patch: Partial<ItemRow>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  // ------------------------------------------------------------------
  // Estados de carga / error
  // ------------------------------------------------------------------
  if (productQuery.isPending || recipeQuery.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (productQuery.isError || recipeQuery.isError) {
    const err = productQuery.error ?? recipeQuery.error;
    return (
      <div className="space-y-6">
        <BackLink />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ServerOff className="size-6 text-destructive" />
            </div>
            <p className="font-medium">
              {err instanceof ApiError
                ? err.message
                : "No se pudo cargar la receta"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void productQuery.refetch();
                void recipeQuery.refetch();
              }}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackLink />
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Receta de {product?.name ?? "producto"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Precio de venta:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatARS(price)}
            </span>
            {!hasRecipe && (
              <Badge variant="outline" className="ml-2">
                Sin receta guardada
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasRecipe && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Eliminar receta
            </Button>
          )}
          <Button onClick={save} disabled={!canSave || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save />
            )}
            Guardar receta
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-4 md:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="recipe-yield">Rinde (porciones)</Label>
                  <Input
                    id="recipe-yield"
                    inputMode="decimal"
                    value={yieldInput}
                    onChange={(event) => setYieldInput(event.target.value)}
                    className="tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cantidad de porciones que salen de esta preparación. Por
                    ej.: 1 kg = 5 porciones → rinde 5.
                  </p>
                  {yieldQuantity <= 0 && (
                    <p className="text-xs text-destructive">
                      El rinde debe ser mayor a 0.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <label className="flex h-9 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(event) => setActive(event.target.checked)}
                      className="size-4 accent-primary"
                    />
                    <span className="text-sm">Receta activa</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Solo las recetas activas descuentan insumos al cargar
                    producción.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4 md:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Ingredientes</h2>
                {rawMaterialsQuery.isError && (
                  <p className="text-xs text-destructive">
                    No se pudieron cargar los insumos.
                  </p>
                )}
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-56">Insumo</TableHead>
                      <TableHead className="w-28">Cantidad</TableHead>
                      <TableHead className="w-24">Merma %</TableHead>
                      <TableHead className="w-32 text-right">Costo</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Quitar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {computedItems.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell>
                          <Combobox
                            options={rawMaterialOptions}
                            value={item.rawMaterialId}
                            onChange={(rawMaterialId) =>
                              updateItem(item.key, { rawMaterialId })
                            }
                            loading={rawMaterialsQuery.isPending}
                            placeholder="Elegir insumo…"
                            searchPlaceholder="Buscar insumo…"
                            emptyText="No hay insumos para esa búsqueda"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Input
                              inputMode="decimal"
                              placeholder="0"
                              value={item.quantityInput}
                              onChange={(event) =>
                                updateItem(item.key, {
                                  quantityInput: event.target.value,
                                })
                              }
                              className="tabular-nums"
                              aria-label="Cantidad"
                            />
                            {item.material && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {UNIT_SHORT[item.material.unit]}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            inputMode="decimal"
                            placeholder="0"
                            value={item.wasteInput}
                            onChange={(event) =>
                              updateItem(item.key, {
                                wasteInput: event.target.value,
                              })
                            }
                            className="tabular-nums"
                            aria-label="Merma %"
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.material ? formatARS(item.cost) : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setItems((current) =>
                                current.length > 1
                                  ? current.filter((i) => i.key !== item.key)
                                  : [emptyItem()],
                              )
                            }
                            aria-label="Quitar ingrediente"
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setItems((current) => [...current, emptyItem()])}
              >
                <Plus />
                Agregar ingrediente
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Resumen de costos en vivo */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="space-y-4 p-4 md:p-6">
            <h2 className="text-base font-semibold">Costos en vivo</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Total ingredientes</dt>
                <dd className="font-medium tabular-nums">
                  {formatARS(live.ingredientsCost)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  Costo unitario{" "}
                  {yieldQuantity > 0 && (
                    <span className="text-xs">(÷ {yieldInput})</span>
                  )}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatARS(live.unitCost)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Precio de venta</dt>
                <dd className="font-medium tabular-nums">{formatARS(price)}</dd>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Margen</dt>
                  <dd
                    className={cn(
                      "font-semibold tabular-nums",
                      live.marginPercent !== null &&
                        marginColor(live.marginPercent),
                    )}
                  >
                    {formatARS(live.margin)}
                    {live.marginPercent !== null && (
                      <span className="ml-1.5">
                        ({percentFormatter.format(live.marginPercent)} %)
                      </span>
                    )}
                  </dd>
                </div>
                {live.marginPercent === null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Definí un precio de venta para calcular el margen.
                  </p>
                )}
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Cada línea se calcula como cantidad × (1 + merma/100) × costo
              promedio del insumo.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Confirmación de borrado de receta */}
      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Eliminar receta</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés eliminar la receta de{" "}
            <span className="font-medium text-foreground">
              {product?.name}
            </span>
            ? El producto pasa a operar 100 % independiente: su stock no
            descuenta materia prima y deja de calcularse el costo por receta.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDeleteOpen(false)}
            disabled={deleteMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending && <Loader2 className="animate-spin" />}
            Eliminar receta
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/recetas"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Volver a recetas
    </Link>
  );
}
