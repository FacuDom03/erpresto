"use client";

import { useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ServerOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { deleteProduct, getCategories, getProducts } from "@/lib/products";
import type { Product } from "@/lib/types";
import { formatARS } from "@/lib/utils";
import { ProductDialog } from "@/components/products/product-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

export default function ProductosPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Debounce de la búsqueda (300 ms) y reset de página.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const productsQuery = useQuery({
    queryKey: ["products", { page, limit: PAGE_SIZE, search }],
    queryFn: () => getProducts({ page, limit: PAGE_SIZE, search }),
    placeholderData: keepPreviousData,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    staleTime: 5 * 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto eliminado");
      setProductToDelete(null);
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "No se pudo eliminar el producto",
      );
    },
  });

  const products = productsQuery.data?.data ?? [];
  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categoriesQuery.data]);

  const errorMessage =
    productsQuery.error instanceof ApiError
      ? productsQuery.error.message
      : "Ocurrió un error al cargar los productos";

  const openCreate = () => {
    setEditingProduct(null);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrá el catálogo de productos de tu carta.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Nuevo producto
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nombre o SKU…"
              className="pl-8"
            />
          </div>

          {productsQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : productsQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <ServerOff className="size-6 text-destructive" />
              </div>
              <div>
                <p className="font-medium">{errorMessage}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Verificá que la API esté corriendo en{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}
                  </code>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void productsQuery.refetch()}
              >
                <RefreshCw />
                Reintentar
              </Button>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Package className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">
                  {search
                    ? "No encontramos productos para tu búsqueda"
                    : "Todavía no hay productos"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Probá con otro término o limpiá la búsqueda."
                    : "Creá el primer producto de tu catálogo."}
                </p>
              </div>
              {!search && (
                <Button size="sm" onClick={openCreate}>
                  <Plus />
                  Nuevo producto
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const categoryName =
                        product.category?.name ??
                        (product.categoryId
                          ? categoryNames.get(product.categoryId)
                          : undefined);
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="font-medium">{product.name}</div>
                            {product.description && (
                              <div className="max-w-md truncate text-xs text-muted-foreground">
                                {product.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {product.sku}
                            </code>
                          </TableCell>
                          <TableCell>
                            {categoryName ? (
                              <Badge variant="secondary">{categoryName}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Sin categoría
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatARS(product.price)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal />
                                  <span className="sr-only">
                                    Acciones de {product.name}
                                  </span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openEdit(product)}
                                >
                                  <Pencil />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive hover:text-destructive [&_svg]:text-destructive"
                                  onClick={() => setProductToDelete(product)}
                                >
                                  <Trash2 />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <p>
                  Mostrando{" "}
                  <span className="font-medium text-foreground">
                    {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, total)}
                  </span>{" "}
                  de <span className="font-medium text-foreground">{total}</span>{" "}
                  productos
                  {productsQuery.isFetching && (
                    <Loader2 className="ml-2 inline size-3.5 animate-spin" />
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft />
                    Anterior
                  </Button>
                  <span className="tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        categories={categoriesQuery.data ?? []}
        categoriesError={categoriesQuery.isError}
      />

      {/* Confirmación de borrado */}
      <Dialog
        open={productToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null);
        }}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Eliminar producto</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés eliminar{" "}
            <span className="font-medium text-foreground">
              {productToDelete?.name}
            </span>
            ? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setProductToDelete(null)}
            disabled={deleteMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (productToDelete) deleteMutation.mutate(productToDelete.id);
            }}
          >
            {deleteMutation.isPending && <Loader2 className="animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
