import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ReportColumn, ReportData } from './report.types';

/** Formatea un valor de celda según el tipo de columna (para texto/PDF). */
function formatCell(value: unknown, type: ReportColumn['type']): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (type === 'currency') {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : String(value);
  }
  if (type === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : String(value);
  }
  return String(value);
}

/** CSV nativo (RFC 4180-ish): comillas dobles escapadas, separador coma. */
export function toCsv(report: ReportData): Buffer {
  const esc = (s: string): string => {
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [];
  lines.push(report.columns.map((c) => esc(c.label)).join(','));
  for (const row of report.rows) {
    lines.push(report.columns.map((c) => esc(formatCell(row[c.key], c.type))).join(','));
  }
  // Fila de totales (si hay): solo en columnas con total definido.
  if (Object.keys(report.totals).length > 0) {
    lines.push(
      report.columns
        .map((c, i) =>
          c.key in report.totals
            ? esc(formatCell(report.totals[c.key], c.type))
            : i === 0
              ? esc('TOTAL')
              : '',
        )
        .join(','),
    );
  }
  // BOM para compatibilidad con Excel (acentos).
  return Buffer.from('﻿' + lines.join('\r\n'), 'utf-8');
}

/** XLSX con exceljs: encabezado, filas tipadas y fila de totales. */
export async function toXlsx(report: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ERPresto';
  const ws = wb.addWorksheet(report.meta.title.slice(0, 31) || 'Reporte');

  ws.columns = report.columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.max(12, c.label.length + 2),
  }));
  ws.getRow(1).font = { bold: true };

  for (const row of report.rows) {
    const values: Record<string, unknown> = {};
    for (const c of report.columns) {
      const v = row[c.key];
      values[c.key] =
        c.type === 'currency' || c.type === 'number' ? Number(v ?? 0) : (v ?? '');
    }
    ws.addRow(values);
  }

  if (Object.keys(report.totals).length > 0) {
    const totalRow: Record<string, unknown> = {};
    report.columns.forEach((c, i) => {
      if (c.key in report.totals) {
        totalRow[c.key] =
          c.type === 'currency' || c.type === 'number'
            ? Number(report.totals[c.key] ?? 0)
            : report.totals[c.key];
      } else if (i === 0) {
        totalRow[c.key] = 'TOTAL';
      }
    });
    const added = ws.addRow(totalRow);
    added.font = { bold: true };
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** PDF con pdfkit: encabezado del tenant + rango, tabla simple. */
export function toPdf(report: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Encabezado
    doc.fontSize(16).text(report.meta.tenantName, { continued: false });
    doc.moveDown(0.2);
    doc.fontSize(13).text(report.meta.title);
    const range =
      report.meta.from || report.meta.to
        ? `Rango: ${report.meta.from ?? '—'} a ${report.meta.to ?? '—'}`
        : 'Rango: completo';
    doc.fontSize(9).fillColor('#555').text(range);
    doc.fillColor('#000').moveDown(0.5);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / report.columns.length;
    const startX = doc.page.margins.left;
    let y = doc.y;

    const drawRow = (cells: string[], bold: boolean): void => {
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc.fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica');
      report.columns.forEach((c, i) => {
        const align = c.type === 'currency' || c.type === 'number' ? 'right' : 'left';
        doc.text(cells[i] ?? '', startX + i * colWidth + 2, y + 3, {
          width: colWidth - 4,
          align,
          lineBreak: false,
        });
      });
      // línea separadora
      doc
        .moveTo(startX, y + 16)
        .lineTo(startX + pageWidth, y + 16)
        .strokeColor('#ddd')
        .lineWidth(0.5)
        .stroke();
      y += 18;
    };

    // Header de tabla
    drawRow(
      report.columns.map((c) => c.label),
      true,
    );
    // Filas
    for (const row of report.rows) {
      drawRow(
        report.columns.map((c) => formatCellForPdf(row[c.key], c.type)),
        false,
      );
    }
    // Totales
    if (Object.keys(report.totals).length > 0) {
      drawRow(
        report.columns.map((c, i) =>
          c.key in report.totals
            ? formatCellForPdf(report.totals[c.key], c.type)
            : i === 0
              ? 'TOTAL'
              : '',
        ),
        true,
      );
    }

    doc.end();
  });
}

function formatCellForPdf(value: unknown, type: ReportColumn['type']): string {
  return formatCell(value, type);
}
