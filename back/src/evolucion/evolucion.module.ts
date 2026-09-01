import { Module } from '@nestjs/common';
import { EvolucionController } from './evolucion.controller';
import { EvolucionService } from './evolucion.service';
import { FormatosHcService } from './formatos-hc.service';

@Module({
  controllers: [EvolucionController],
  providers: [EvolucionService, FormatosHcService],
})
export class EvolucionModule {}
