import { Module } from '@nestjs/common';
import { ClickhouseModule } from './clickhouse/clickhouse.module';
import { LogsModule } from './logs/logs.module';
import { ConfigModule } from './config/config.module';
import { InputsModule } from './inputs/inputs.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ClickhouseModule, LogsModule, ConfigModule, InputsModule, UsersModule],
})
export class AppModule {}
