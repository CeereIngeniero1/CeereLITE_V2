import { Body, Controller, Post, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import type { JwtPayload } from '../auth/auth.service';
import { logExecutionError } from './execution-error-log';
import { ClientLogDto } from './dto/client-log.dto';

@Controller('logs')
export class LogsController {
  @Post('cliente')
  cliente(
    @Body() dto: ClientLogDto,
    @Request() req: ExpressRequest & { user?: JwtPayload },
  ) {
    const href = String(dto.href ?? '').trim().slice(0, 500);
    logExecutionError({
      method: req.method,
      url: href || req.originalUrl || req.url,
      message: String(dto.message ?? '').slice(0, 8000),
      stack: dto.stack ? String(dto.stack).slice(0, 4000) : undefined,
      context: `cliente ${req.user?.username ?? ''}`.trim(),
    });
    return { ok: true };
  }
}
