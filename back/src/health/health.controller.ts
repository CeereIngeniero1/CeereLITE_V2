import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  live() {
    return {
      ok: true,
      service: 'ceerelite-nest-api',
      ts: new Date().toISOString(),
    };
  }

  @Get('db')
  async database() {
    try {
      await this.healthService.checkDatabase();
      return {
        ok: true,
        db: true,
        server: this.config.get<string>('DB_SERVER') ?? '',
        catalog: this.config.get<string>('DB_NAME') ?? '',
        ts: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DB check failed';
      throw new ServiceUnavailableException({
        ok: false,
        db: false,
        error: message,
        ts: new Date().toISOString(),
      });
    }
  }
}
