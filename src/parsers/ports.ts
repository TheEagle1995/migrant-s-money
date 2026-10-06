import { ParserTemplate } from './sms-parser';

export interface ParserTemplateRepository {
  activeSince(version: number): Promise<ParserTemplate[]>;
  upsert(t: ParserTemplate): Promise<void>;
}

export const PARSER_REPO = Symbol('PARSER_REPO');
