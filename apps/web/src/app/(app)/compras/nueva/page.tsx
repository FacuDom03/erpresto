"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useBranch } from "@/lib/branch";
import { BranchRequired } from "@/components/branch-required";
import { PurchaseOrderForm } from "@/components/purchases/purchase-order-form";
import { Button } from "@/components/ui/button";

export default function NuevaOrdenCompraPage() {
  const router = useRouter();
  const { branchId } = useBranch();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/compras")}
        >
          <ArrowLeft />
          Compras
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nueva orden de compra
        </h1>
        <p className="text-sm text-muted-foreground">
          La orden se crea en borrador; después podés enviarla al proveedor.
        </p>
      </div>

      {branchId === null ? (
        <BranchRequired />
      ) : (
        <PurchaseOrderForm branchId={branchId} />
      )}
    </div>
  );
}
