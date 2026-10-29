import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

export const ACCESS_COOKIE = 'ceere_access';
export const REFRESH_COOKIE = 'ceere_refresh';

export function parseExpiresToSeconds(
  raw: string | undefined,
  fallback: number,
): number {
  const s = String(raw ?? '').trim();
  const m = /^(\d+)([smhd])$/i.exec(s);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  return fallback;
}

export function cookieSecure(config: ConfigService): boolean {
  return config.get<string>('NODE_ENV') === 'production';
}

export function setAuthCookies(
  res: Response,
  access: string,
  refresh: string,
  config: ConfigService,
): void {
  const secure = cookieSecure(config);
  const accessMax =
    parseExpiresToSeconds(config.get<string>('JWT_EXPIRES_IN'), 3600) * 1000;
  const refreshMax =
    parseExpiresToSeconds(config.get<string>('JWT_REFRESH_EXPIRES_IN'), 36000) *
    1000;
  res.cookie(ACCESS_COOKIE, access, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: accessMax,
    secure,
  });
  res.cookie(REFRESH_COOKIE, refresh, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: refreshMax,
    secure,
  });
}

export function clearAuthCookies(res: Response, config: ConfigService): void {
  const secure = cookieSecure(config);
  res.clearCookie(ACCESS_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
  });
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api/v1/auth',
    secure,
  });
}

export function sessionPublicFields(issued: {
  username: string;
  userLevel: number;
  documentoEntidad: string;
  nombreUsuario: string;
}) {
  return {
    username: issued.username,
    userLevel: issued.userLevel,
    documentoEntidad: issued.documentoEntidad,
    nombreUsuario: issued.nombreUsuario,
  };
}
