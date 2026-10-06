import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaService } from './infra/prisma/prisma.service';
import {
  PrismaConsentRepo, PrismaEventRepo, PrismaFetchRunRepo, PrismaParserRepo,
  PrismaProviderRepo, PrismaQuoteRepo, PrismaTransferRepo,
} from './infra/prisma/repositories';

import { FETCH_RUN_REPO, PROVIDER_REPO, QUOTE_REPO } from './rates/ports';
import { CONSENT_REPO, EVENT_REPO, TRANSFER_REPO } from './household/ports';
import { PARSER_REPO } from './parsers/ports';
import { PROVIDER_ADAPTERS } from './rates/provider.contract';

import { ComparisonService } from './rates/comparison.service';
import { ManualImportService } from './rates/manual-import.service';
import { RatesRunner } from './rates/rates.runner';
import { MatchingService } from './matching/matching.service';
import { GoalsService, GOAL_REPO } from './household/goals.service';
import { PrismaGoalRepo } from './infra/prisma/goal.repository';
import { TelegramBot } from './bot/telegram.bot';
import { AlertsService, ALERT_REPO } from './bot/alerts.service';
import { PrismaAlertRepo } from './infra/prisma/alert.repository';

import { RatesController } from './http/rates.controller';
import { HouseholdController } from './http/household.controller';
import { ParsersController } from './http/parsers.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ScheduleModule.forRoot()],
  controllers: [RatesController, HouseholdController, ParsersController],
  providers: [
    PrismaService,
    { provide: PROVIDER_REPO, useClass: PrismaProviderRepo },
    { provide: QUOTE_REPO, useClass: PrismaQuoteRepo },
    { provide: FETCH_RUN_REPO, useClass: PrismaFetchRunRepo },
    { provide: TRANSFER_REPO, useClass: PrismaTransferRepo },
    { provide: EVENT_REPO, useClass: PrismaEventRepo },
    { provide: CONSENT_REPO, useClass: PrismaConsentRepo },
    { provide: PARSER_REPO, useClass: PrismaParserRepo },
    { provide: GOAL_REPO, useClass: PrismaGoalRepo },
    { provide: ALERT_REPO, useClass: PrismaAlertRepo },
    // Faza 0: avtomatik adapter yo'q. Provayderlar kursni faqat app ichida,
    // login ortida ko'rsatadi. Ma'lumot ManualImportService orqali kiradi.
    { provide: PROVIDER_ADAPTERS, useValue: [] },
    ComparisonService,
    ManualImportService,
    RatesRunner,
    MatchingService,
    GoalsService,
    AlertsService,
    TelegramBot,
  ],
})
export class AppModule {}
