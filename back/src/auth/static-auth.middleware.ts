import type { NextFunction, Request, Response } from 'express';
import type { JwtService } from '@nestjs/jwt';
import { ACCESS_COOKIE } from './auth-cookies';

const STATIC_PREFIXES = ['/static-images', '/formatos-hc', '/firma-entidad'];

function bearerToken(req: Request): string {
  const h = String(req.headers.authorization ?? '');
  if (!h.toLowerCase().startsWith('bearer ')) return '';
  return h.slice(7).trim();
}

export function staticAuthMiddleware(jwt: JwtService, accessSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const path = String(req.path || req.url || '').split('?')[0];
    if (!STATIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      next();
      return;
    }
    const token =
      bearerToken(req) || String(req.cookies?.[ACCESS_COOKIE] ?? '').trim();
    if (!token) {
      res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      return;
    }
    try {
      const payload = jwt.verify(token, { secret: accessSecret }) as {
        typ?: string;
      };
      if (payload.typ === 'refresh') {
        res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
        return;
      }
      next();
    } catch {
      res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
    }
  };
}
