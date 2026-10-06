import { BadRequestException, Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { MatchingService } from '../matching/matching.service';
import { TRANSFER_REPO, TransferRepository } from '../household/ports';
import { PROVIDER_REPO, ProviderRepository, QUOTE_REPO, QuoteRepository } from '../rates/ports';
import {
  confirmMatchSchema, contributeSchema, createGoalSchema,
  declareTransferSchema, ingestEventSchema, jsonSafe,
} from './dto';
import { GoalsService } from '../household/goals.service';
import { ZodPipe } from './zod.pipe';
import { normalizeTo } from '../domain/money';
import { findCorridor } from '../domain/corridor';

@Controller('household')
export class HouseholdController {
  constructor(
    private readonly matching: MatchingService,
    private readonly goals: GoalsService,
    @Inject(TRANSFER_REPO) private readonly transfers: TransferRepository,
    @Inject(PROVIDER_REPO) private readonly providers: ProviderRepository,
    @Inject(QUOTE_REPO) private readonly quotes: QuoteRepository,
  ) {}

  /** "Yubordim" tugmasi. Prognoz joriy kotirovkadan olinadi — match uchun asos. */
  @Post('transfers')
  async declare(@Body(new ZodPipe(declareTransferSchema)) dto: any) {
    const corridor = findCorridor(dto.corridorId);
    if (!corridor) throw new BadRequestException(`Noma'lum koridor: ${dto.corridorId}`);

    let providerId: string | null = null;
    let expected: bigint | null = null;

    if (dto.providerSlug) {
      const p = await this.providers.findBySlug(dto.providerSlug);
      if (p) {
        providerId = p.id;
        const latest = await this.quotes.latestPerProvider(corridor.id);
        const q = latest.find((x) => x.providerId === p.id);
        if (q) expected = normalizeTo(q.recvMinor, q.sendMinor, dto.sentMinor);
      }
    }

    const t = await this.transfers.create({
      householdId: dto.householdId,
      corridorId: corridor.id,
      providerId,
      sentMinor: dto.sentMinor,
      expectedRecvMinor: expected,
      declaredAt: dto.declaredAt ?? new Date(),
    });
    return jsonSafe(t);
  }

  /** Qurilmadan kelgan parse natijasi. Raw SMS emas. */
  @Post('events')
  async ingest(@Body(new ZodPipe(ingestEventSchema)) dto: any) {
    return jsonSafe(await this.matching.ingest(dto));
  }

  /** Hal qilinmagan mosliklar — ilovada "qaysi biri?" ekrani uchun */
  @Get(':householdId/pending')
  async pending(@Param('householdId') householdId: string) {
    const items = await this.transfers.findPending(householdId);
    return jsonSafe(items);
  }

  @Get(':householdId/goals')
  async listGoals(@Param('householdId') householdId: string) {
    return jsonSafe(await this.goals.list(householdId));
  }

  @Post('goals')
  async createGoal(@Body(new ZodPipe(createGoalSchema)) dto: any) {
    return jsonSafe(
      await this.goals.create({
        householdId: dto.householdId,
        title: dto.title,
        targetMinor: dto.targetMinor,
        dueDate: dto.dueDate ?? null,
      }),
    );
  }

  @Post('goals/contribute')
  async contribute(@Body(new ZodPipe(contributeSchema)) dto: any) {
    return jsonSafe(await this.goals.contribute(dto.goalId, dto.amountMinor));
  }

  /** "Qaysi biri?" ekrani uchun nomzodlar */
  @Get('transfers/:transferId/candidates')
  async candidates(@Param('transferId') transferId: string) {
    return jsonSafe(await this.matching.candidatesFor(transferId));
  }

  @Post('matches/confirm')
  async confirm(@Body(new ZodPipe(confirmMatchSchema)) dto: any) {
    await this.matching.confirm(dto.transferId, dto.eventId, 'user');
    return { ok: true };
  }
}
