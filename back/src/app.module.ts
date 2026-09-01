import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as fs from 'fs';
import { envValidationSchema } from './config/env.validation';
import { typeOrmFactory } from './config/typeorm.config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompanyModule } from './company/company.module';
import { EvolucionModule } from './evolucion/evolucion.module';
import { AgendaModule } from './agenda/agenda.module';
import { RdaModule } from './rda/rda.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmFactory,
    }),
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const entries = [
          {
            rootPath: config.getOrThrow<string>('STATIC_IMAGES_PATH'),
            serveRoot: '/static-images/',
            serveStaticOptions: { fallthrough: true, index: false },
          },
        ];
        const formatosPath = config.get<string>('FORMATOS_HC_PATH');
        if (formatosPath && fs.existsSync(formatosPath)) {
          entries.push({
            rootPath: formatosPath,
            serveRoot: '/formatos-hc/',
            serveStaticOptions: { fallthrough: true, index: false },
          });
        }
        const firmaPath = config.get<string>('FIRMA_ENTIDAD_PATH');
        if (firmaPath && fs.existsSync(firmaPath)) {
          entries.push({
            rootPath: firmaPath,
            serveRoot: '/firma-entidad/',
            serveStaticOptions: { fallthrough: true, index: false },
          });
        }
        return entries;
      },
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    CompanyModule,
    EvolucionModule,
    AgendaModule,
    RdaModule,
  ],
})
export class AppModule {}
