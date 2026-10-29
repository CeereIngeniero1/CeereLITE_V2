import { Body, Controller, Post, Request, Res } from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { ACCESS_COOKIE } from '../auth/auth-cookies';
import { PrintPdfDto } from './dto/print-pdf.dto';
import { PrintService } from './print.service';

@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Post('pdf')
  async pdf(
    @Body() dto: PrintPdfDto,
    @Request() req: ExpressRequest,
    @Res() res: Response,
  ) {
    const header = String(req.headers.authorization ?? '');
    const bearer = header.toLowerCase().startsWith('bearer ')
      ? header.slice(7).trim()
      : '';
    const access =
      bearer || String(req.cookies?.[ACCESS_COOKIE] ?? '').trim();
    const buf = await this.printService.htmlToPdf(dto.html, access);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento.pdf"');
    res.send(buf);
  }
}
