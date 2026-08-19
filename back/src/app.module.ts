import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { envValidationSchema } from './config/env.validation';
import { typeOrmFactory } from './config/typeorm.config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompanyModule } from './company/company.module';
import { EvolucionModule } from './evolucion/evolucion.module';
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
      useFactory: (config: ConfigService) => [
        {
          rootPath: config.getOrThrow<string>('STATIC_IMAGES_PATH'),
          serveRoot: '/static-images/',
          serveStaticOptions: { fallthrough: true, index: false },
        },
      ],
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    CompanyModule,
    EvolucionModule,
    RdaModule,
  ],
})
export class AppModule {}
