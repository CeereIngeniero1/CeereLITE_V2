import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtPayload } from './auth.service';
import { ACCESS_COOKIE } from './auth-cookies';

function cookieOrBearer(req: Request): string | null {
  const cookie = String(req?.cookies?.[ACCESS_COOKIE] ?? '').trim();
  if (cookie) return cookie;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: cookieOrBearer,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (payload.typ === 'refresh') {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
