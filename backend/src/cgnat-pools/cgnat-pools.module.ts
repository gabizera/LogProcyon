import { Module } from '@nestjs/common';
import { CgnatPoolsService } from './cgnat-pools.service';
import { CgnatPoolsController } from './cgnat-pools.controller';

@Module({
  providers: [CgnatPoolsService],
  controllers: [CgnatPoolsController],
  exports: [CgnatPoolsService],
})
export class CgnatPoolsModule {}
