"use client";

import type * as React from "react";
import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DiningTable, TableShape, TableStatus } from "@/lib/types";

/** Metadata visual por estado de mesa (color de nodo, punto de leyenda y label). */
export const TABLE_STATUS_META: Record<
  TableStatus,
  { label: string; node: string; dot: string }
> = {
  FREE: {
    label: "Libre",
    node: "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  OCCUPIED: {
    label: "Ocupada",
    node: "border-red-500/60 bg-red-500/20 text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  WAITING_KITCHEN: {
    label: "Esperando cocina",
    node: "border-amber-500/70 bg-amber-500/20 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  WAITING_BILL: {
    label: "Esperando cuenta",
    node: "border-blue-500/60 bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  RESERVED: {
    label: "Reservada",
    node: "border-violet-500/60 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  OUT_OF_SERVICE: {
    label: "Fuera de servicio",
    node: "border-border bg-muted text-muted-foreground opacity-70",
    dot: "bg-zinc-400",
  },
};

export const TABLE_SHAPE_LABELS: Record<TableShape, string> = {
  ROUND: "Redonda",
  SQUARE: "Cuadrada",
  RECTANGLE: "Rectángulo",
  BOX: "Box",
  BAR: "Barra",
  DECOR: "Decoración",
};

const SHAPE_RADIUS: Record<TableShape, string> = {
  ROUND: "rounded-full",
  SQUARE: "rounded-xl",
  RECTANGLE: "rounded-lg",
  BOX: "rounded-sm",
  BAR: "rounded-full",
  DECOR: "rounded-md border-dashed",
};

interface TableNodeProps {
  table: DiningTable;
  mode: "operation" | "edit";
  selected?: boolean;
  onSelect?: (table: DiningTable) => void;
  /** pointerdown sobre el cuerpo de la mesa (drag de movimiento en edición). */
  onMoveStart?: (event: React.PointerEvent, table: DiningTable) => void;
  /** pointerdown sobre el handle de redimensionado. */
  onResizeStart?: (event: React.PointerEvent, table: DiningTable) => void;
}

/**
 * Nodo visual de una mesa en el canvas del salón. En operación el color sale
 * del estado; en edición se usa el color custom (si hay) y se muestran los
 * handles de selección/redimensionado.
 */
export function TableNode({
  table,
  mode,
  selected = false,
  onSelect,
  onMoveStart,
  onResizeStart,
}: TableNodeProps) {
  const isDecor = table.shape === "DECOR";
  const isEdit = mode === "edit";
  const interactive = isEdit || !isDecor;

  const statusMeta = TABLE_STATUS_META[table.status] ?? TABLE_STATUS_META.FREE;

  const style: React.CSSProperties = {
    left: table.x,
    top: table.y,
    width: table.width,
    height: table.height,
    transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
  };
  if (isEdit && table.color) {
    style.backgroundColor = table.color;
  } else if (!isEdit && table.color && !isDecor) {
    // En operación el estado manda; el color custom queda como acento de borde.
    style.borderColor = table.color;
  }

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      data-table-id={table.id}
      className={cn(
        "absolute flex select-none flex-col items-center justify-center border-2 px-1 text-center shadow-sm transition-shadow",
        SHAPE_RADIUS[table.shape] ?? "rounded-lg",
        isDecor
          ? "border-border bg-muted/60 text-muted-foreground"
          : isEdit
            ? "border-border bg-card text-foreground"
            : statusMeta.node,
        interactive && "cursor-pointer hover:shadow-md",
        isEdit && "touch-none",
        isEdit && selected && "border-primary ring-2 ring-ring",
        !isEdit && table.status === "OUT_OF_SERVICE" && !isDecor && "line-through",
      )}
      style={style}
      onClick={() => {
        if (interactive) onSelect?.(table);
      }}
      onKeyDown={(event) => {
        if (interactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect?.(table);
        }
      }}
      onPointerDown={(event) => {
        if (isEdit) onMoveStart?.(event, table);
      }}
    >
      <span className="max-w-full truncate text-xs font-semibold leading-tight">
        {table.name}
      </span>
      {!isDecor && table.capacity > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] opacity-80">
          <Users className="size-2.5" />
          {table.capacity}
        </span>
      )}
      {!isEdit && table.mergedIntoId && (
        <span className="text-[9px] font-medium uppercase tracking-wide opacity-70">
          unida
        </span>
      )}
      {isEdit && selected && (
        <span
          role="presentation"
          className="absolute -bottom-1.5 -right-1.5 size-4 cursor-nwse-resize rounded-sm border border-primary bg-background shadow"
          onPointerDown={(event) => {
            event.stopPropagation();
            onResizeStart?.(event, table);
          }}
        />
      )}
    </div>
  );
}
