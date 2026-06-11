"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Armchair,
  BarChart3,
  Boxes,
  CalendarClock,
  ChefHat,
  ClipboardList,
  CookingPot,
  Factory,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  UtensilsCrossed,
  Users,
  Wallet,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Salón",
    items: [
      { title: "Mesas", href: "/mesas", icon: Armchair },
      { title: "Reservas", href: "/reservas", icon: CalendarClock },
    ],
  },
  {
    label: "Ventas",
    items: [
      { title: "POS", href: "/pos", icon: MonitorSmartphone },
      { title: "Cocina (KDS)", href: "/cocina", icon: CookingPot },
      { title: "Pedidos", href: "/pedidos", icon: ClipboardList },
      { title: "Caja", href: "/caja", icon: Wallet },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { title: "Productos", href: "/productos", icon: Package },
      { title: "Categorías", href: "/categorias", icon: Tags },
      { title: "Recetas", href: "/recetas", icon: UtensilsCrossed },
    ],
  },
  {
    label: "Stock",
    items: [
      { title: "Materia Prima", href: "/stock/materia-prima", icon: Wheat },
      { title: "Producción", href: "/stock/produccion", icon: Factory },
    ],
  },
  {
    label: "Compras",
    items: [
      { title: "Órdenes", href: "/compras", icon: ShoppingCart },
      { title: "Proveedores", href: "/proveedores", icon: Truck },
    ],
  },
  {
    label: "Gestión",
    items: [
      { title: "Clientes", href: "/clientes", icon: Users },
      { title: "Reportes", href: "/reportes", icon: BarChart3 },
      { title: "Configuración", href: "/configuracion", icon: Settings },
    ],
  },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-card transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 border-b px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ChefHat className="size-4" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight">ERPresto</span>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {NAV_SECTIONS.map((section, index) => (
          <div key={section.label ?? index}>
            {section.label && !collapsed && (
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        collapsed && "justify-center px-0 py-2",
                        active
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
            <Boxes className="size-3.5 shrink-0" />
            <span className="flex items-center gap-1.5">
              v0.1.0
              <ReceiptText className="size-3" /> beta
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
