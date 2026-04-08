import { Module } from '@nestjs/common';
import { ClickhouseModule } from './clickhouse/clickhouse.module';
import { LogsModule } from './logs/logs.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [ClickhouseModule, LogsModule, AiModule],
})
export class AppModule {}
