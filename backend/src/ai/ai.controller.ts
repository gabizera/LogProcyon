import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

class AnalyzeDto {
  prompt: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze')
  analyze(@Body() dto: AnalyzeDto) {
    return this.aiService.analyze(dto.prompt);
  }
}
