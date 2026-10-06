import { Controller, Get, Inject, Query } from '@nestjs/common';
import { PARSER_REPO, ParserTemplateRepository } from '../parsers/ports';

/**
 * App ishga tushganda `GET /parsers?since=<version>` qiladi.
 * Bank SMS formatini o'zgartirsa — shablon serverda yangilanadi,
 * foydalanuvchi app'ni yangilamaydi.
 */
@Controller('parsers')
export class ParsersController {
  constructor(@Inject(PARSER_REPO) private readonly repo: ParserTemplateRepository) {}

  @Get()
  async list(@Query('since') since?: string) {
    const v = since ? Number(since) : 0;
    return this.repo.activeSince(Number.isFinite(v) ? v : 0);
  }
}
