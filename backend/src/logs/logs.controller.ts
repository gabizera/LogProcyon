import { Controller, Get, Param, Query } from '@nestjs/common';
import { LogsService } from './logs.service';
import { SearchLogsDto, StatsQueryDto, JudicialQueryDto } from './dto/search-logs.dto';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  search(@Query() dto: SearchLogsDto) {
    return this.logsService.search(dto);
  }

  @Get('stats')
  stats(@Query() dto: StatsQueryDto) {
    return this.logsService.getStats(dto);
  }

  @Get('judicial')
  judicial(@Query() dto: JudicialQueryDto) {
    return this.logsService.judicialSearch(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.logsService.findById(id);
  }
}
