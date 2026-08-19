import { Module } from '@nestjs/common';
import { RdaController } from './rda.controller';
import { RdaService } from './rda.service';

@Module({
  controllers: [RdaController],
  providers: [RdaService],
})
export class RdaModule {}
