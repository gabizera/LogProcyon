import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { InputsModule } from '../inputs/inputs.module';
import { CgnatPoolsModule } from '../cgnat-pools/cgnat-pools.module';

@Module({
  imports: [InputsModule, CgnatPoolsModule],
  controllers: [LogsController],
  providers: [LogsService],
})
export class LogsModule {}
