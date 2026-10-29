import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Request,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService, JwtPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from './public.decorator';
import type { UploadedFotoFile } from '../entidad-foto';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  sessionPublicFields,
  setAuthCookies,
} from './auth-cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const issued = await this.authService.login(dto);
    setAuthCookies(res, issued.token, issued.refreshToken, this.config);
    return sessionPublicFields(issued);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw =
      String(dto.refreshToken ?? '').trim() ||
      String(req.cookies?.[REFRESH_COOKIE] ?? '').trim();
    const issued = await this.authService.refresh(raw);
    setAuthCookies(res, issued.token, issued.refreshToken, this.config);
    return sessionPublicFields(issued);
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookies(res, this.config);
    return { ok: true };
  }

  @Get('me')
  me(@Request() req: ExpressRequest & { user: JwtPayload }) {
    return this.authService.getProfile(req.user);
  }

  @Patch('me')
  updateMe(
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user, dto);
  }

  @Post('me/foto')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  updateMyFoto(
    @Request() req: ExpressRequest & { user: JwtPayload },
    @UploadedFile() file: UploadedFotoFile,
  ) {
    return this.authService.updateFoto(req.user, file);
  }
}
