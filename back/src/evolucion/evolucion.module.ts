import { Module } from '@nestjs/common';
import { EvolucionController } from './evolucion.controller';
import { EvolucionService } from './evolucion.service';

@Module({
  controllers: [EvolucionController],
  providers: [EvolucionService],
})
export class EvolucionModule {}
