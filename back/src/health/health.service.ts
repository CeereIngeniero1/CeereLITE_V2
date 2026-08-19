import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async checkDatabase(): Promise<{ ok: boolean }> {
    await this.dataSource.query('SELECT 1 AS ok');
    return { ok: true };
  }
}
