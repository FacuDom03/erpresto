import { Store } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/** Estado vacío para páginas operativas cuando no hay sucursal activa. */
export function BranchRequired() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Store className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">No hay una sucursal activa</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Elegí o ingresá una sucursal desde el selector del header para
            operar con este módulo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
