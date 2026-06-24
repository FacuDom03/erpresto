import { Badge, type BadgeProps } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS } from "@/lib/invoices";
import type { InvoiceStatus } from "@/lib/types";

const STATUS_VARIANT: Record<InvoiceStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary",
  PENDING_CAE: "warning",
  ISSUED: "success",
  REJECTED: "destructive",
  CANCELLED: "outline",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}
