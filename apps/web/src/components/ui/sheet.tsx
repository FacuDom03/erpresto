"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Clases extra para el panel (por ej. max-w-md). */
  className?: string;
}

/**
 * Panel lateral derecho (estilo shadcn Sheet) escrito a mano: overlay con
 * click para cerrar, tecla Escape y scroll-lock del body.
 */
function Sheet({ open, onOpenChange, children, className }: SheetProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        className="animate-overlay-in fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-sheet-in fixed inset-y-0 right-0 z-10 flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-l bg-card p-6 text-card-foreground shadow-xl",
          className,
        )}
      >
        {children}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 cursor-pointer rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
          <span className="sr-only">Cerrar</span>
        </button>
      </div>
    </div>
  );
}

function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-left", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export { Sheet, SheetHeader, SheetTitle, SheetDescription };
