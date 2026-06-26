"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Línea secundaria opcional (por ej. SKU o unidad). */
  description?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  /**
   * Si se pasa, la búsqueda es controlada externamente (server-side) y el
   * componente NO filtra localmente. Sin esta prop filtra por label.
   */
  onSearchChange?: (search: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Combobox con búsqueda escrito a mano (sin Radix), consistente con el resto
 * de los inputs: trigger tipo select, panel con input de filtro y lista
 * navegable con teclado (flechas + Enter + Escape).
 */
export function Combobox({
  options,
  value,
  onChange,
  onSearchChange,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  emptyText = "Sin resultados",
  loading = false,
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [highlighted, setHighlighted] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const filtered = React.useMemo(() => {
    if (onSearchChange) return options; // búsqueda server-side
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        (o.description ?? "").toLowerCase().includes(term),
    );
  }, [options, search, onSearchChange]);

  const selected = options.find((o) => o.value === value) ?? null;
  // Recuerda el label elegido aunque las opciones cambien (búsqueda server-side).
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null);
  const displayLabel = selected?.label ?? (value ? selectedLabel : null);

  // Cierre por click afuera.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Autofocus del input al abrir.
  React.useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setHighlighted(0);
    }
  }, [open]);

  // Mantiene la opción resaltada visible al navegar con teclado.
  React.useEffect(() => {
    if (!open) return;
    const item = listRef.current?.children[highlighted] as
      | HTMLElement
      | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  const updateSearch = (next: string) => {
    setSearch(next);
    setHighlighted(0);
    onSearchChange?.(next);
  };

  const selectOption = (option: ComboboxOption) => {
    onChange(option.value);
    setSelectedLabel(option.label);
    setOpen(false);
    updateSearch("");
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlighted];
      if (option) selectOption(option);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-left text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
        )}
      >
        <span className={cn("truncate", !displayLabel && "text-muted-foreground")}>
          {displayLabel ?? placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-transparent pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-56 overflow-y-auto p-1">
            {loading ? (
              <li className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Cargando…
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                {emptyText}
              </li>
            ) : (
              filtered.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => selectOption(option)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-sm",
                    index === highlighted && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {option.value === value && (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
