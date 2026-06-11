"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Eye,
  Link2,
  Link2Off,
  Loader2,
  Pencil,
  PencilRuler,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ServerOff,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ApiError, getErrorMessage } from "@/lib/api";
import { useBranch } from "@/lib/branch";
import { useRealtime } from "@/lib/realtime";
import {
  createArea,
  createTable,
  defaultTableSize,
  deleteArea,
  deleteTable,
  getAreas,
  mergeTable,
  saveLayout,
  splitTable,
  updateArea,
  updateTable,
  type UpdateTablePayload,
} from "@/lib/tables";
import { createOrder, extractConflictOrderId, getOrders } from "@/lib/orders";
import type { Area, DiningTable, TableShape, TableStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BranchRequired } from "@/components/branch-required";
import {
  TABLE_SHAPE_LABELS,
  TABLE_STATUS_META,
  TableNode,
} from "@/components/tables/table-node";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const CANVAS_WIDTH = 1160;
const CANVAS_HEIGHT = 720;
const GRID = 10;
const MIN_SIZE = 30;

const ADDABLE_SHAPES: TableShape[] = [
  "ROUND",
  "SQUARE",
  "RECTANGLE",
  "BOX",
  "BAR",
  "DECOR",
];

const STATUS_ORDER: TableStatus[] = [
  "FREE",
  "OCCUPIED",
  "WAITING_KITCHEN",
  "WAITING_BILL",
  "RESERVED",
  "OUT_OF_SERVICE",
];

interface DraftTable extends DiningTable {
  isNew?: boolean;
}

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const DIFF_KEYS = [
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "name",
  "capacity",
  "shape",
] as const;

function tableChanged(draft: DraftTable, base: DiningTable): boolean {
  if ((draft.color ?? null) !== (base.color ?? null)) return true;
  if (draft.areaId !== base.areaId) return true;
  return DIFF_KEYS.some((key) => draft[key] !== base[key]);
}

export default function MesasPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { branchId } = useBranch();
  useRealtime(branchId);

  const [editMode, setEditMode] = useState(false);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [draftTables, setDraftTables] = useState<DraftTable[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const baselineRef = useRef<Map<string, DiningTable>>(new Map());
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [isViewingOrder, setIsViewingOrder] = useState(false);
  const [areaDialog, setAreaDialog] = useState<
    { mode: "create" } | { mode: "rename"; area: Area } | { mode: "delete"; area: Area } | null
  >(null);
  const [areaNameInput, setAreaNameInput] = useState("");

  const areasQuery = useQuery({
    queryKey: ["areas", branchId],
    queryFn: () => getAreas(branchId as string),
    enabled: Boolean(branchId),
    refetchInterval: editMode ? false : 15_000,
  });

  const areas = useMemo(() => areasQuery.data ?? [], [areasQuery.data]);
  const serverTables = useMemo(() => areas.flatMap((a) => a.tables), [areas]);
  const areaNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of areas) map.set(area.id, area.name);
    return map;
  }, [areas]);

  // Área activa por defecto (o corrección si fue eliminada).
  useEffect(() => {
    if (areas.length === 0) return;
    if (!activeAreaId || !areas.some((a) => a.id === activeAreaId)) {
      setActiveAreaId(areas[0].id);
    }
  }, [areas, activeAreaId]);

  const allTables: DraftTable[] = editMode ? draftTables : serverTables;
  const visibleTables = allTables.filter((t) => t.areaId === activeAreaId);
  const selectedTable =
    allTables.find((t) => t.id === selectedTableId) ?? null;

  const dirty = useMemo(() => {
    if (!editMode) return false;
    if (deletedIds.length > 0) return true;
    return draftTables.some((t) => {
      if (t.isNew) return true;
      const base = baselineRef.current.get(t.id);
      return !base || tableChanged(t, base);
    });
  }, [editMode, draftTables, deletedIds]);

  // -------------------------------------------------------------------------
  // Modo edición: draft + drag & drop
  // -------------------------------------------------------------------------

  const enterEditMode = () => {
    baselineRef.current = new Map(serverTables.map((t) => [t.id, { ...t }]));
    setDraftTables(serverTables.map((t) => ({ ...t })));
    setDeletedIds([]);
    setSelectedTableId(null);
    setEditMode(true);
  };

  const exitEditMode = (force = false) => {
    if (
      dirty &&
      !force &&
      !window.confirm("Hay cambios sin guardar. ¿Salir de la edición igual?")
    ) {
      return;
    }
    setEditMode(false);
    setDraftTables([]);
    setDeletedIds([]);
    setSelectedTableId(null);
  };

  const updateDraft = (id: string, patch: Partial<DraftTable>) => {
    setDraftTables((tables) =>
      tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  const beginPointerDrag = (kind: "move" | "resize") => {
    return (event: React.PointerEvent, table: DiningTable) => {
      if (!editMode || event.button !== 0) return;
      event.preventDefault();
      setSelectedTableId(table.id);
      const start = {
        x: event.clientX,
        y: event.clientY,
        orig: { ...table },
      };
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (kind === "move") {
          updateDraft(table.id, {
            x: clamp(snap(start.orig.x + dx), 0, CANVAS_WIDTH - start.orig.width),
            y: clamp(
              snap(start.orig.y + dy),
              0,
              CANVAS_HEIGHT - start.orig.height,
            ),
          });
        } else {
          updateDraft(table.id, {
            width: clamp(
              snap(start.orig.width + dx),
              MIN_SIZE,
              CANVAS_WIDTH - start.orig.x,
            ),
            height: clamp(
              snap(start.orig.height + dy),
              MIN_SIZE,
              CANVAS_HEIGHT - start.orig.y,
            ),
          });
        }
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    };
  };

  const addDraftTable = (shape: TableShape) => {
    if (!activeAreaId) return;
    const size = defaultTableSize(shape);
    const areaCount = draftTables.filter((t) => t.areaId === activeAreaId).length;
    const id = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const table: DraftTable = {
      id,
      areaId: activeAreaId,
      name: shape === "DECOR" ? "Decoración" : `Mesa ${areaCount + 1}`,
      shape,
      status: "FREE",
      capacity: shape === "DECOR" ? 0 : shape === "BAR" ? 6 : 4,
      x: clamp(snap(40 + (areaCount % 8) * 40), 0, CANVAS_WIDTH - size.width),
      y: clamp(snap(40 + Math.floor(areaCount / 8) * 40), 0, CANVAS_HEIGHT - size.height),
      width: size.width,
      height: size.height,
      rotation: 0,
      color: null,
      mergedIntoId: null,
      isNew: true,
    };
    setDraftTables((tables) => [...tables, table]);
    setSelectedTableId(id);
  };

  const removeDraftTable = (table: DraftTable) => {
    setDraftTables((tables) => tables.filter((t) => t.id !== table.id));
    if (!table.isNew) setDeletedIds((ids) => [...ids, table.id]);
    if (selectedTableId === table.id) setSelectedTableId(null);
  };

  const saveLayoutMutation = useMutation({
    mutationFn: async () => {
      // 1. Mesas nuevas (POST con layout completo)
      for (const t of draftTables.filter((t) => t.isNew)) {
        await createTable({
          areaId: t.areaId,
          name: t.name,
          shape: t.shape,
          capacity: t.capacity || undefined,
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.height,
          rotation: t.rotation,
          color: t.color ?? undefined,
        });
      }
      // 2. Mesas eliminadas
      for (const id of deletedIds) {
        await deleteTable(id);
      }
      // 3. Propiedades cambiadas de mesas existentes
      const existing = draftTables.filter((t) => !t.isNew);
      for (const t of existing) {
        const base = baselineRef.current.get(t.id);
        if (!base) continue;
        const patch: UpdateTablePayload = {};
        if (t.name !== base.name) patch.name = t.name;
        if (t.capacity !== base.capacity) patch.capacity = t.capacity;
        if (t.shape !== base.shape) patch.shape = t.shape;
        if ((t.color ?? null) !== (base.color ?? null)) {
          patch.color = t.color ?? null;
        }
        if (t.areaId !== base.areaId) patch.areaId = t.areaId;
        if (Object.keys(patch).length > 0) await updateTable(t.id, patch);
      }
      // 4. Posiciones de todas las existentes
      if (existing.length > 0) {
        await saveLayout(
          existing.map(({ id, x, y, width, height, rotation }) => ({
            id,
            x,
            y,
            width,
            height,
            rotation,
          })),
        );
      }
    },
    onSuccess: () => {
      toast.success("Layout del salón guardado");
      void queryClient.invalidateQueries({ queryKey: ["areas"] });
      exitEditMode(true);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo guardar el layout"));
      void queryClient.invalidateQueries({ queryKey: ["areas"] });
    },
  });

  // -------------------------------------------------------------------------
  // Áreas (crear / renombrar / eliminar — mutaciones inmediatas)
  // -------------------------------------------------------------------------

  const areaMutation = useMutation({
    mutationFn: async () => {
      if (!areaDialog) return;
      if (areaDialog.mode === "create") {
        if (!branchId) throw new ApiError(0, "Sin sucursal activa");
        return createArea(branchId, areaNameInput.trim());
      }
      if (areaDialog.mode === "rename") {
        return updateArea(areaDialog.area.id, { name: areaNameInput.trim() });
      }
      return deleteArea(areaDialog.area.id);
    },
    onSuccess: () => {
      if (areaDialog?.mode === "delete") {
        setDraftTables((tables) =>
          tables.filter((t) => t.areaId !== areaDialog.area.id),
        );
        toast.success("Área eliminada");
      } else {
        toast.success(
          areaDialog?.mode === "create" ? "Área creada" : "Área renombrada",
        );
      }
      setAreaDialog(null);
      void queryClient.invalidateQueries({ queryKey: ["areas"] });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo guardar el área"));
    },
  });

  // -------------------------------------------------------------------------
  // Modo operación: acciones sobre la mesa seleccionada
  // -------------------------------------------------------------------------

  const openOrderMutation = useMutation({
    mutationFn: (tableId: string) =>
      createOrder({ branchId: branchId as string, type: "DINE_IN", tableId }),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["areas"] });
      router.push(`/pos/${order.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        const existingId = extractConflictOrderId(err.data);
        if (existingId) {
          toast.info("La mesa ya tiene un pedido abierto");
          router.push(`/pos/${existingId}`);
          return;
        }
      }
      toast.error(getErrorMessage(err, "No se pudo abrir el pedido"));
    },
  });

  const viewOrder = async (table: DiningTable) => {
    if (!branchId) return;
    setIsViewingOrder(true);
    try {
      const res = await getOrders({
        branchId,
        tableId: table.id,
        status: "OPEN",
        limit: 1,
      });
      const order = res.data[0];
      if (order) {
        router.push(`/pos/${order.id}`);
      } else {
        toast.info("La mesa no tiene un pedido abierto");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo buscar el pedido"));
    } finally {
      setIsViewingOrder(false);
    }
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableStatus }) =>
      updateTable(id, { status }),
    onSuccess: () => {
      toast.success("Estado de la mesa actualizado");
      void queryClient.invalidateQueries({ queryKey: ["areas"] });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo cambiar el estado"));
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ id, intoTableId }: { id: string; intoTableId: string }) =>
      mergeTable(id, intoTableId),
    onSuccess: () => {
      toast.success("Mesa unida");
      setMergeTargetId("");
      void queryClient.invalidateQueries({ queryKey: ["areas"] });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo unir la mesa"));
    },
  });

  const splitMutation = useMutation({
    mutationFn: (id: string) => splitTable(id),
    onSuccess: () => {
      toast.success("Mesa separada");
      void queryClient.invalidateQueries({ queryKey: ["areas"] });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudo separar la mesa"));
    },
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!branchId) {
    return (
      <div className="space-y-6">
        <PageTitle editMode={false} />
        <BranchRequired />
      </div>
    );
  }

  if (areasQuery.isPending) {
    return (
      <div className="space-y-6">
        <PageTitle editMode={false} />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  }

  if (areasQuery.isError) {
    return (
      <div className="space-y-6">
        <PageTitle editMode={false} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ServerOff className="size-6 text-destructive" />
            </div>
            <p className="font-medium">
              {getErrorMessage(areasQuery.error, "No se pudo cargar el salón")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void areasQuery.refetch()}
            >
              <RefreshCw />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeArea = areas.find((a) => a.id === activeAreaId) ?? null;
  const isSelectedOpenable =
    selectedTable !== null &&
    (selectedTable.status === "FREE" || selectedTable.status === "RESERVED");
  const isSelectedBusy =
    selectedTable !== null &&
    ["OCCUPIED", "WAITING_KITCHEN", "WAITING_BILL"].includes(
      selectedTable.status,
    );
  const mergeCandidates = serverTables.filter(
    (t) =>
      selectedTable !== null &&
      t.id !== selectedTable.id &&
      t.shape !== "DECOR" &&
      !t.mergedIntoId,
  );
  const mergedIntoName = selectedTable?.mergedIntoId
    ? (serverTables.find((t) => t.id === selectedTable.mergedIntoId)?.name ??
      "otra mesa")
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle editMode={editMode} />
        <div className="flex flex-wrap items-center gap-2">
          {editMode ? (
            <>
              {dirty && (
                <Badge variant="warning" className="whitespace-nowrap">
                  Cambios sin guardar
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => exitEditMode()}
                disabled={saveLayoutMutation.isPending}
              >
                <Undo2 />
                Salir sin guardar
              </Button>
              <Button
                size="sm"
                onClick={() => saveLayoutMutation.mutate()}
                disabled={!dirty || saveLayoutMutation.isPending}
              >
                {saveLayoutMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Check />
                )}
                Guardar layout
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={enterEditMode}>
              <PencilRuler />
              Editar salón
            </Button>
          )}
        </div>
      </div>

      {/* Tabs de áreas */}
      <div className="flex flex-wrap items-center gap-2">
        {areas.map((area) => (
          <button
            key={area.id}
            type="button"
            onClick={() => setActiveAreaId(area.id)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
              area.id === activeAreaId
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {area.name}
          </button>
        ))}
        {editMode && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAreaNameInput("");
                setAreaDialog({ mode: "create" });
              }}
            >
              <Plus />
              Área
            </Button>
            {activeArea && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title={`Renombrar ${activeArea.name}`}
                  onClick={() => {
                    setAreaNameInput(activeArea.name);
                    setAreaDialog({ mode: "rename", area: activeArea });
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  title={`Eliminar ${activeArea.name}`}
                  onClick={() => setAreaDialog({ mode: "delete", area: activeArea })}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {areas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="font-medium">Todavía no hay áreas en el salón</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Creá la primera área (por ej. &quot;Salón principal&quot; o
              &quot;Terraza&quot;) para empezar a ubicar mesas.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setAreaNameInput("");
                setAreaDialog({ mode: "create" });
              }}
            >
              <Plus />
              Crear área
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {editMode ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
              <span className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Agregar
              </span>
              {ADDABLE_SHAPES.map((shape) => (
                <Button
                  key={shape}
                  variant="outline"
                  size="sm"
                  onClick={() => addDraftTable(shape)}
                >
                  <Plus />
                  {TABLE_SHAPE_LABELS[shape]}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {STATUS_ORDER.map((status) => (
                <span key={status} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      TABLE_STATUS_META[status].dot,
                    )}
                  />
                  {TABLE_STATUS_META[status].label}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4 xl:flex-row">
            {/* Canvas del salón */}
            <Card className="min-w-0 flex-1 overflow-auto">
              <div
                className={cn(
                  "relative",
                  editMode &&
                    "bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] bg-[length:20px_20px]",
                )}
                style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
              >
                {visibleTables.map((table) => (
                  <TableNode
                    key={table.id}
                    table={table}
                    mode={editMode ? "edit" : "operation"}
                    selected={selectedTableId === table.id}
                    onSelect={(t) => {
                      setSelectedTableId(t.id);
                      setMergeTargetId("");
                    }}
                    onMoveStart={beginPointerDrag("move")}
                    onResizeStart={beginPointerDrag("resize")}
                  />
                ))}
                {visibleTables.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      {editMode
                        ? "No hay mesas en esta área: agregá una con los botones de arriba."
                        : "Esta área no tiene mesas todavía."}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Panel de propiedades (edición) */}
            {editMode && (
              <Card className="w-full shrink-0 xl:w-72">
                <CardContent className="space-y-4 p-4">
                  {selectedTable && editMode ? (
                    <EditPanel
                      table={selectedTable}
                      onChange={(patch) => updateDraft(selectedTable.id, patch)}
                      onDelete={() => removeDraftTable(selectedTable)}
                    />
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Seleccioná una mesa del plano para editar sus propiedades,
                      o arrastrala para moverla (grilla de {GRID}px).
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Sheet de mesa (operación) */}
      <Sheet
        open={!editMode && selectedTable !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTableId(null);
        }}
      >
        {selectedTable && !editMode && (
          <>
            <SheetHeader>
              <SheetTitle>{selectedTable.name}</SheetTitle>
              <SheetDescription>
                {areaNames.get(selectedTable.areaId) ?? "Área"}
                {selectedTable.capacity > 0 &&
                  ` · ${selectedTable.capacity} personas`}
              </SheetDescription>
            </SheetHeader>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  TABLE_STATUS_META[selectedTable.status].dot,
                )}
              />
              <span className="text-sm font-medium">
                {TABLE_STATUS_META[selectedTable.status].label}
              </span>
            </div>

            {mergedIntoName && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                Esta mesa está unida a{" "}
                <span className="font-medium text-foreground">
                  {mergedIntoName}
                </span>
                .
              </p>
            )}

            <div className="space-y-2">
              {isSelectedOpenable && (
                <Button
                  className="w-full"
                  disabled={openOrderMutation.isPending}
                  onClick={() => openOrderMutation.mutate(selectedTable.id)}
                >
                  {openOrderMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ReceiptText />
                  )}
                  Abrir pedido
                </Button>
              )}
              {isSelectedBusy && (
                <Button
                  className="w-full"
                  disabled={isViewingOrder}
                  onClick={() => void viewOrder(selectedTable)}
                >
                  {isViewingOrder ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Eye />
                  )}
                  Ver pedido
                </Button>
              )}
              {selectedTable.status === "OUT_OF_SERVICE" ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({
                      id: selectedTable.id,
                      status: "FREE",
                    })
                  }
                >
                  <Check />
                  Habilitar mesa
                </Button>
              ) : (
                isSelectedOpenable && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({
                        id: selectedTable.id,
                        status: "OUT_OF_SERVICE",
                      })
                    }
                  >
                    <X />
                    Poner fuera de servicio
                  </Button>
                )
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Unir mesas</p>
              {selectedTable.mergedIntoId ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={splitMutation.isPending}
                  onClick={() => splitMutation.mutate(selectedTable.id)}
                >
                  {splitMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Link2Off />
                  )}
                  Separar de {mergedIntoName}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Select
                    value={mergeTargetId}
                    onChange={(event) => setMergeTargetId(event.target.value)}
                  >
                    <option value="">Elegir mesa destino…</option>
                    {mergeCandidates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({areaNames.get(t.areaId) ?? "Área"})
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!mergeTargetId || mergeMutation.isPending}
                    onClick={() =>
                      mergeMutation.mutate({
                        id: selectedTable.id,
                        intoTableId: mergeTargetId,
                      })
                    }
                  >
                    {mergeMutation.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Link2 />
                    )}
                    Unir a la mesa seleccionada
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Sheet>

      {/* Dialog de áreas (crear / renombrar / eliminar) */}
      <Dialog
        open={areaDialog !== null}
        onOpenChange={(open) => {
          if (!open) setAreaDialog(null);
        }}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>
            {areaDialog?.mode === "create" && "Nueva área"}
            {areaDialog?.mode === "rename" && "Renombrar área"}
            {areaDialog?.mode === "delete" && "Eliminar área"}
          </DialogTitle>
          {areaDialog?.mode === "delete" && (
            <DialogDescription>
              ¿Seguro que querés eliminar{" "}
              <span className="font-medium text-foreground">
                {areaDialog.area.name}
              </span>
              ? Si tiene mesas con pedidos abiertos la operación va a fallar.
            </DialogDescription>
          )}
        </DialogHeader>
        {areaDialog && areaDialog.mode !== "delete" && (
          <div className="space-y-2">
            <Label htmlFor="area-name">Nombre del área</Label>
            <Input
              id="area-name"
              value={areaNameInput}
              onChange={(event) => setAreaNameInput(event.target.value)}
              placeholder="Por ej. Salón principal"
              autoFocus
            />
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setAreaDialog(null)}
            disabled={areaMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant={areaDialog?.mode === "delete" ? "destructive" : "default"}
            disabled={
              areaMutation.isPending ||
              (areaDialog?.mode !== "delete" && !areaNameInput.trim())
            }
            onClick={() => areaMutation.mutate()}
          >
            {areaMutation.isPending && <Loader2 className="animate-spin" />}
            {areaDialog?.mode === "delete" ? "Eliminar" : "Guardar"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function PageTitle({ editMode }: { editMode: boolean }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mesas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {editMode
          ? "Modo edición: arrastrá las mesas, redimensionalas y guardá el layout."
          : "Mapa del salón en tiempo real. Tocá una mesa para operar."}
      </p>
    </div>
  );
}

function EditPanel({
  table,
  onChange,
  onDelete,
}: {
  table: DiningTable;
  onChange: (patch: Partial<DiningTable>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Propiedades de la mesa</p>

      <div className="space-y-1.5">
        <Label htmlFor="t-name">Nombre</Label>
        <Input
          id="t-name"
          value={table.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="t-capacity">Capacidad</Label>
          <Input
            id="t-capacity"
            type="number"
            min={0}
            value={table.capacity}
            onChange={(event) =>
              onChange({
                capacity: Math.max(0, Number(event.target.value) || 0),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-shape">Forma</Label>
          <Select
            id="t-shape"
            value={table.shape}
            onChange={(event) => {
              const shape = event.target.value as TableShape;
              onChange({ shape, ...defaultTableSize(shape) });
            }}
          >
            {ADDABLE_SHAPES.map((shape) => (
              <option key={shape} value={shape}>
                {TABLE_SHAPE_LABELS[shape]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="t-width">Ancho (px)</Label>
          <Input
            id="t-width"
            type="number"
            min={MIN_SIZE}
            step={GRID}
            value={table.width}
            onChange={(event) =>
              onChange({
                width: clamp(
                  snap(Number(event.target.value) || MIN_SIZE),
                  MIN_SIZE,
                  CANVAS_WIDTH,
                ),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-height">Alto (px)</Label>
          <Input
            id="t-height"
            type="number"
            min={MIN_SIZE}
            step={GRID}
            value={table.height}
            onChange={(event) =>
              onChange({
                height: clamp(
                  snap(Number(event.target.value) || MIN_SIZE),
                  MIN_SIZE,
                  CANVAS_HEIGHT,
                ),
              })
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Rotación ({table.rotation}°)</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({ rotation: (table.rotation - 45 + 360) % 360 })
            }
          >
            <RotateCcw />
            -45°
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ rotation: (table.rotation + 45) % 360 })}
          >
            <RotateCw />
            +45°
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="t-color">Color de fondo</Label>
        <div className="flex items-center gap-2">
          <input
            id="t-color"
            type="color"
            value={table.color ?? "#64748b"}
            onChange={(event) => onChange({ color: event.target.value })}
            className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!table.color}
            onClick={() => onChange({ color: null })}
          >
            Sin color
          </Button>
        </div>
      </div>

      <div className="border-t pt-3">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={onDelete}
        >
          <Trash2 />
          Eliminar mesa
        </Button>
      </div>
    </div>
  );
}
