import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ARCA_PROVIDER,
  ArcaInvoiceInput,
  ArcaInvoiceLine,
  ArcaProvider,
} from './arca/arca-provider.interface';
import { CreateCreditNoteDto, CreditNoteItemDto } from './dto/credit-note.dto';
import { CreateInvoiceFromOrderDto } from './dto/create-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';

type Tx = Prisma.TransactionClient;

type IvaCondition = 'RI' | 'MONOTRIBUTO' | 'EXENTO';

interface FiscalConfig {
  cuit: string;
  pointOfSale: number;
  ivaCondition: IvaCondition;
}

/** Línea de comprobante calculada server-side (IVA incluido criterio AR). */
interface InvoiceLine {
  description: string;
  quantity: number;
  unitPriceWithTax: number;
  taxRate: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class InvoicingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ARCA_PROVIDER) private readonly arca: ArcaProvider,
  ) {}

  // ----------------------------------------------------------
  // Listado y detalle
  // ----------------------------------------------------------
  async findAll(tenantId: string, query: QueryInvoicesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { customer: { name: { contains: query.search, mode: 'insensitive' } } },
              { customer: { taxId: { contains: query.search, mode: 'insensitive' } } },
              ...(Number.isInteger(Number(query.search))
                ? [{ order: { number: Number(query.search) } }]
                : []),
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, taxId: true } },
          order: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data: rows.map((r) => this.shape(r)), total };
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { id: true, name: true, taxId: true } },
        order: { select: { id: true, number: true } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }
    return this.shape(invoice);
  }

  // ----------------------------------------------------------
  // Crear factura desde un pedido CLOSED
  // ----------------------------------------------------------
  async createFromOrder(tenantId: string, orderId: string, dto: CreateInvoiceFromOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: {
          where: { NOT: { status: 'CANCELLED' } },
          include: { product: { select: { name: true, taxRate: true } } },
        },
        customer: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    if (order.status !== 'CLOSED') {
      throw new BadRequestException('Solo se pueden facturar pedidos cerrados (CLOSED)');
    }
    if (order.items.length === 0) {
      throw new BadRequestException('El pedido no tiene items facturables');
    }

    // 409 si ya tiene una factura emitida (no NC).
    const existing = await this.prisma.invoice.findFirst({
      where: {
        orderId,
        status: InvoiceStatus.ISSUED,
        type: { in: [InvoiceType.FACTURA_A, InvoiceType.FACTURA_B, InvoiceType.FACTURA_C] },
      },
    });
    if (existing) {
      throw new ConflictException({
        message: 'El pedido ya tiene una factura emitida',
        invoiceId: existing.id,
      });
    }

    const fiscal = await this.getFiscalConfig(tenantId);

    // Cliente a facturar (override o el del pedido).
    let customer = order.customer;
    if (dto.customerId) {
      customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId },
      });
      if (!customer) {
        throw new BadRequestException('El cliente no pertenece al tenant');
      }
    }

    const type = dto.type ?? this.determineInvoiceType(fiscal.ivaCondition, customer?.taxId ?? null);

    // Líneas desde OrderItem (precio con IVA incluido, criterio AR).
    const lines: InvoiceLine[] = order.items.map((item) => {
      const quantity = Number(item.quantity);
      const unitPriceWithTax = Number(item.unitPrice);
      const taxRate = Number(item.product.taxRate);
      return this.buildLine(item.product.name, quantity, unitPriceWithTax, taxRate);
    });

    return this.issueInvoice(tenantId, {
      branchId: order.branchId,
      orderId: order.id,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? null,
      customerTaxId: customer?.taxId ?? null,
      type,
      fiscal,
      lines,
    });
  }

  // ----------------------------------------------------------
  // Nota de crédito (total o parcial) espejando una factura ISSUED
  // ----------------------------------------------------------
  async createCreditNote(tenantId: string, invoiceId: string, dto: CreateCreditNoteDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { customer: true },
    });
    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Solo se pueden acreditar facturas emitidas (ISSUED)');
    }
    const creditType = this.creditNoteTypeFor(invoice.type);
    if (!creditType) {
      throw new BadRequestException('La factura origen no admite nota de crédito');
    }

    const fiscal = await this.getFiscalConfig(tenantId);

    let lines: InvoiceLine[];
    if (dto.items && dto.items.length > 0) {
      lines = dto.items.map((i: CreditNoteItemDto) =>
        this.buildLine(i.description, i.quantity, i.unitPriceWithTax, i.taxRate),
      );
    } else {
      // NC total: reconstruir desde el payload de la factura origen.
      const payload = invoice.arcaPayload as { lines?: ArcaInvoiceLine[] } | null;
      if (payload?.lines && payload.lines.length > 0) {
        lines = payload.lines.map((l) =>
          this.buildLine(l.description, l.quantity, l.unitPriceWithTax, l.taxRate),
        );
      } else {
        // Fallback: una sola línea con los totales de la factura.
        const net = Number(invoice.netAmount);
        const tax = Number(invoice.taxAmount);
        const taxRate = net > 0 ? round2((tax / net) * 100) : 0;
        lines = [
          {
            description: `Nota de crédito s/ factura ${invoice.pointOfSale}-${invoice.number}`,
            quantity: 1,
            unitPriceWithTax: Number(invoice.totalAmount),
            taxRate,
            netAmount: net,
            taxAmount: tax,
            totalAmount: Number(invoice.totalAmount),
          },
        ];
      }
    }

    return this.issueInvoice(tenantId, {
      branchId: invoice.branchId,
      orderId: invoice.orderId,
      customerId: invoice.customerId,
      customerName: invoice.customer?.name ?? null,
      customerTaxId: invoice.customer?.taxId ?? null,
      type: creditType,
      fiscal,
      lines,
      relatedInvoiceId: invoice.id,
    });
  }

  // ----------------------------------------------------------
  // Emisión común: numeración correlativa + provider + persistencia
  // ----------------------------------------------------------
  private async issueInvoice(
    tenantId: string,
    params: {
      branchId: string;
      orderId: string | null;
      customerId: string | null;
      customerName: string | null;
      customerTaxId: string | null;
      type: InvoiceType;
      fiscal: FiscalConfig;
      lines: InvoiceLine[];
      relatedInvoiceId?: string;
    },
  ) {
    const { fiscal, lines, type } = params;
    const totals = this.sumLines(lines);

    // 1) Reservar el número correlativo por (pointOfSale, type) en
    //    transacción, con retry ante colisión P2002.
    const maxAttempts = 4;
    let draftId: string | null = null;
    let assignedNumber = 0;
    for (let attempt = 1; ; attempt++) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const number = await this.nextInvoiceNumber(tx, tenantId, fiscal.pointOfSale, type);
          const draft = await tx.invoice.create({
            data: {
              tenantId,
              branchId: params.branchId,
              orderId: params.orderId,
              customerId: params.customerId,
              type,
              status: InvoiceStatus.PENDING_CAE,
              pointOfSale: fiscal.pointOfSale,
              number,
              netAmount: new Prisma.Decimal(totals.netAmount),
              taxAmount: new Prisma.Decimal(totals.taxAmount),
              totalAmount: new Prisma.Decimal(totals.totalAmount),
            },
          });
          return { draft, number };
        });
        draftId = created.draft.id;
        assignedNumber = created.number;
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < maxAttempts
        ) {
          continue;
        }
        throw error;
      }
    }

    // 2) Solicitar el CAE al provider (fuera de la transacción: I/O externo).
    const arcaInput: ArcaInvoiceInput = {
      type,
      pointOfSale: fiscal.pointOfSale,
      number: assignedNumber,
      issuerCuit: fiscal.cuit,
      issuerIvaCondition: fiscal.ivaCondition,
      customerTaxId: params.customerTaxId,
      customerName: params.customerName,
      netAmount: totals.netAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      lines,
      date: new Date(),
    };
    const result = await this.arca.requestCae(arcaInput);

    // 3) Persistir resultado (ISSUED + CAE o REJECTED) con el payload ARCA.
    const payload: Prisma.InputJsonValue = {
      ...(arcaInput as unknown as Record<string, unknown>),
      date: arcaInput.date.toISOString(),
      ...(params.relatedInvoiceId ? { relatedInvoiceId: params.relatedInvoiceId } : {}),
      result: result.approved
        ? { approved: true, cae: result.cae, caeExpiry: result.caeExpiry.toISOString() }
        : { approved: false, reason: result.reason },
    };

    const updated = await this.prisma.invoice.update({
      where: { id: draftId! },
      data: result.approved
        ? {
            status: InvoiceStatus.ISSUED,
            cae: result.cae,
            caeExpiry: result.caeExpiry,
            issuedAt: new Date(),
            arcaPayload: payload,
          }
        : {
            status: InvoiceStatus.REJECTED,
            arcaPayload: payload,
          },
      include: {
        customer: { select: { id: true, name: true, taxId: true } },
        order: { select: { id: true, number: true } },
      },
    });

    return this.shape(updated);
  }

  // ----------------------------------------------------------
  // Helpers de cálculo y configuración
  // ----------------------------------------------------------

  /** Numeración correlativa por (pointOfSale, type) dentro del tenant. */
  private async nextInvoiceNumber(
    tx: Tx,
    tenantId: string,
    pointOfSale: number,
    type: InvoiceType,
  ): Promise<number> {
    const agg = await tx.invoice.aggregate({
      where: { tenantId, pointOfSale, type, number: { not: null } },
      _max: { number: true },
    });
    return (agg._max.number ?? 0) + 1;
  }

  /**
   * Desglosa una línea con IVA incluido (criterio AR):
   *   neto = totalConIva / (1 + taxRate/100)
   *   iva  = totalConIva - neto
   */
  private buildLine(
    description: string,
    quantity: number,
    unitPriceWithTax: number,
    taxRate: number,
  ): InvoiceLine {
    const totalAmount = round2(quantity * unitPriceWithTax);
    const netAmount = round2(totalAmount / (1 + taxRate / 100));
    const taxAmount = round2(totalAmount - netAmount);
    return { description, quantity, unitPriceWithTax, taxRate, netAmount, taxAmount, totalAmount };
  }

  private sumLines(lines: InvoiceLine[]) {
    const netAmount = round2(lines.reduce((a, l) => a + l.netAmount, 0));
    const taxAmount = round2(lines.reduce((a, l) => a + l.taxAmount, 0));
    const totalAmount = round2(lines.reduce((a, l) => a + l.totalAmount, 0));
    return { netAmount, taxAmount, totalAmount };
  }

  /** Tipo de factura según condición del emisor y CUIT del cliente. */
  private determineInvoiceType(
    issuerCondition: IvaCondition,
    customerTaxId: string | null,
  ): InvoiceType {
    if (issuerCondition === 'MONOTRIBUTO' || issuerCondition === 'EXENTO') {
      return InvoiceType.FACTURA_C;
    }
    // Emisor RI: A si el cliente tiene CUIT (11 dígitos), B si no.
    const digits = (customerTaxId ?? '').replace(/\D/g, '');
    return digits.length === 11 ? InvoiceType.FACTURA_A : InvoiceType.FACTURA_B;
  }

  private creditNoteTypeFor(type: InvoiceType): InvoiceType | null {
    switch (type) {
      case InvoiceType.FACTURA_A:
        return InvoiceType.NOTA_CREDITO_A;
      case InvoiceType.FACTURA_B:
        return InvoiceType.NOTA_CREDITO_B;
      case InvoiceType.FACTURA_C:
        return InvoiceType.NOTA_CREDITO_C;
      default:
        return null;
    }
  }

  /**
   * Lee la config fiscal de Tenant.settings.fiscal. Si falta, usa un
   * default razonable (pointOfSale 1, RI) y toma el CUIT de Tenant.cuit.
   */
  private async getFiscalConfig(tenantId: string): Promise<FiscalConfig> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { cuit: true, settings: true },
    });
    const settings = (tenant.settings as Record<string, unknown> | null) ?? {};
    const fiscal = (settings.fiscal as Partial<FiscalConfig> | undefined) ?? {};

    const cuit = (fiscal.cuit ?? tenant.cuit ?? '').replace(/\D/g, '') || '20000000001';
    const pointOfSale =
      typeof fiscal.pointOfSale === 'number' && fiscal.pointOfSale > 0 ? fiscal.pointOfSale : 1;
    const ivaCondition: IvaCondition =
      fiscal.ivaCondition === 'MONOTRIBUTO' || fiscal.ivaCondition === 'EXENTO'
        ? fiscal.ivaCondition
        : 'RI';

    return { cuit, pointOfSale, ivaCondition };
  }

  /** Decimals → números (convención del proyecto). */
  private shape(invoice: {
    netAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    [key: string]: unknown;
  }) {
    return {
      ...invoice,
      netAmount: Number(invoice.netAmount),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
    };
  }
}
