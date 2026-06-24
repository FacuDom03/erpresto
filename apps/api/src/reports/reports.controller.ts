import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { QueryReportDto, ReportFormat } from './dto/query-report.dto';
import { toCsv, toPdf, toXlsx } from './report-exporters';
import { ReportData } from './report.types';
import { ReportKey, ReportsService } from './reports.service';

const VALID_KEYS: ReportKey[] = ['sales', 'products', 'waiters', 'cash', 'stock', 'purchases'];

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get(':key')
  @RequirePermissions('reports.view')
  async report(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
    @Query() query: QueryReportDto,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (!VALID_KEYS.includes(key as ReportKey)) {
      res.status(404).json({ statusCode: 404, message: `Reporte desconocido: ${key}` });
      return;
    }

    const report = await this.service.build(user.tenantId, key as ReportKey, query);

    if (!query.format) {
      res.status(200).json({
        columns: report.columns,
        rows: report.rows,
        totals: report.totals,
      });
      return;
    }

    const { buffer, contentType, ext } = await this.exportFile(report, query.format);
    const filename = `reporte-${key}-${query.from ?? 'inicio'}-${query.to ?? 'fin'}.${ext}`;
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.status(200).send(buffer);
  }

  private async exportFile(
    report: ReportData,
    format: ReportFormat,
  ): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
    switch (format) {
      case ReportFormat.CSV:
        return { buffer: toCsv(report), contentType: 'text/csv; charset=utf-8', ext: 'csv' };
      case ReportFormat.XLSX:
        return {
          buffer: await toXlsx(report),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ext: 'xlsx',
        };
      case ReportFormat.PDF:
        return { buffer: await toPdf(report), contentType: 'application/pdf', ext: 'pdf' };
    }
  }
}
