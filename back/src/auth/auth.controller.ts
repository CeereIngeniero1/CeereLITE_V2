import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request as ExpressRequest } from 'express';
import { AuthService, JwtPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { UploadedFotoFile } from '../entidad-foto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: ExpressRequest & { user: JwtPayload }) {
    return this.authService.getProfile(req.user);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user, dto);
  }

  @Post('me/foto')
  @UseGuards(JwtAuthGuard)
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
