import { PURCHASE_STATUS_LABELS } from "@/lib/purchases";
import type { PurchaseOrderStatus } from "@/lib/types";
import type { BadgeProps } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<PurchaseOrderStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary",
  SENT: "warning",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "destructive",
};

/** Badge de estado de orden de compra con etiqueta en español. */
export function PurchaseStatusBadge({
  status,
}: {
  status: PurchaseOrderStatus;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {PURCHASE_STATUS_LABELS[status]}
    </Badge>
  );
}
