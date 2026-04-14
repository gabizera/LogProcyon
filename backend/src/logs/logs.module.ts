import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { InputsModule } from '../inputs/inputs.module';

@Module({
  imports: [InputsModule],
  controllers: [LogsController],
  providers: [LogsService],
})
export class LogsModule {}
