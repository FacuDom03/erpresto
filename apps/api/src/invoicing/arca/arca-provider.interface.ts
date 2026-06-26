import { InvoiceType } from '@prisma/client';

/** Línea de comprobante con desglose de IVA (criterio AR: precio con IVA incluido). */
export interface ArcaInvoiceLine {
  description: string;
  quantity: number;
  unitPriceWithTax: number; // precio unitario CON IVA incluido
  taxRate: number; // alícuota (ej. 21)
  netAmount: number; // neto gravado de la línea
  taxAmount: number; // IVA de la línea
  totalAmount: number; // total de la línea (neto + IVA)
}

/** Datos del comprobante que se envían al proveedor fiscal. */
export interface ArcaInvoiceInput {
  type: InvoiceType;
  pointOfSale: number;
  number: number;
  /** CUIT del emisor (tenant). */
  issuerCuit: string;
  issuerIvaCondition: 'RI' | 'MONOTRIBUTO' | 'EXENTO';
  /** CUIT/DNI del receptor (cliente), si lo hay. */
  customerTaxId?: string | null;
  customerName?: string | null;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  lines: ArcaInvoiceLine[];
  /** Fecha del comprobante. */
  date: Date;
}

export type ArcaResult =
  | { approved: true; cae: string; caeExpiry: Date }
  | { approved: false; reason: string };

/**
 * Puerto de facturación electrónica (ARCA/AFIP). El servicio de
 * facturación depende de esta abstracción; el factory inyecta el
 * mock por defecto o el provider real (WSFE) si hay credenciales.
 */
export interface ArcaProvider {
  requestCae(input: ArcaInvoiceInput): Promise<ArcaResult>;
}

export const ARCA_PROVIDER = 'ARCA_PROVIDER';
