import { Module } from '@nestjs/common';
import { InputsService } from './inputs.service';
import { InputsController } from './inputs.controller';

@Module({
  providers: [InputsService],
  controllers: [InputsController],
  exports: [InputsService],
})
export class InputsModule {}
