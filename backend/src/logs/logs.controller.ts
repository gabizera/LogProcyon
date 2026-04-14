import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import { LogsService } from './logs.service';
import { SearchLogsDto, StatsQueryDto, JudicialQueryDto } from './dto/search-logs.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  search(@Query() dto: SearchLogsDto, @Request() req: any) {
    return this.logsService.search(dto, req.user);
  }

  @Get('stats')
  stats(@Query() dto: StatsQueryDto, @Request() req: any) {
    return this.logsService.getStats(dto, req.user);
  }

  @Get('storage')
  storage(@Request() req: any) {
    return this.logsService.getStorage(req.user);
  }

  @Get('judicial')
  @Roles('admin', 'operator')
  judicial(@Query() dto: JudicialQueryDto, @Request() req: any) {
    return this.logsService.judicialSearch(dto, req.user);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.logsService.findById(id);
  }
}
