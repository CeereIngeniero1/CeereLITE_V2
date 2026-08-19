import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

function parseSqlServerHost(server: string): {
  host: string;
  instanceName?: string;
} {
  const normalized = server.replace(/\//g, '\\');
  if (normalized.includes('\\')) {
    const idx = normalized.indexOf('\\');
    return {
      host: normalized.slice(0, idx),
      instanceName: normalized.slice(idx + 1),
    };
  }
  return { host: normalized };
}

export function typeOrmFactory(config: ConfigService): TypeOrmModuleOptions {
  const rawServer = config.getOrThrow<string>('DB_SERVER');
  const { host, instanceName } = parseSqlServerHost(rawServer);
  const encrypt = config.get<string>('DB_ENCRYPT') === 'true';
  const trustServerCertificate =
    config.get<string>('DB_TRUST_SERVER_CERTIFICATE') !== 'false';

  return {
    type: 'mssql',
    host,
    port: parseInt(config.getOrThrow('DB_PORT'), 10),
    username: config.getOrThrow<string>('DB_USER'),
    password: config.get<string>('DB_PASSWORD') ?? '',
    database: config.getOrThrow<string>('DB_NAME'),
    options: {
      encrypt,
      trustServerCertificate,
      ...(instanceName ? { instanceName } : {}),
    },
    autoLoadEntities: true,
    synchronize: false,
    logging: config.get('NODE_ENV') === 'development',
  };
}
