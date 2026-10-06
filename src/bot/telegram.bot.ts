import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf } from 'telegraf';
import { ComparisonService } from '../rates/comparison.service';
import { renderAlert, renderDailyPost, renderMultiCorridorPost } from './message';
import { AlertsService } from './alerts.service';
import { COUNTRIES, liveCorridors, findCorridor } from '../domain/corridor';
import { parseMinor } from '../domain/currency';

/**
 * Chiroq boti — Faza 0 mahsuloti.
 *
 * App emas, bot: install friksiyasi nol va o'zbek jamoasi Telegram
 * guruhlarida tarqatadi. Bir nechta koridor qo'llanadi, chunki auditoriya
 * Koreya bilan cheklanmaydi.
 */
@Injectable()
export class TelegramBot implements OnModuleInit {
  private readonly log = new Logger(TelegramBot.name);
  private bot?: Telegraf;

  constructor(
    private readonly comparison: ComparisonService,
    private readonly alerts: AlertsService,
  ) {}

  onModuleInit(): void {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.log.warn("TELEGRAM_BOT_TOKEN yo'q — bot ishga tushmadi");
      return;
    }
    this.bot = new Telegraf(token);

    const corridorList = liveCorridors()
      .map((c) => `${COUNTRIES[c.send].flag} ${c.id} — ${COUNTRIES[c.send].nameUz}`)
      .join('\n');

    this.bot.start((ctx) =>
      ctx.reply(
        'Chiroq — pul o\'tkazmalarining yashirin narxini ko\'rsatadi.\n\n' +
        'Har kuni ertalab qaysi kanal ko\'p pul yetkazganini yozib turaman.\n\n' +
        `Koridorlar:\n${corridorList}\n\n` +
        '/kurs — hammasi\n' +
        '/kurs KR-UZ — bitta koridor\n' +
        '/ogohlantir KR-UZ 8600000 — chegaradan oshsa xabar beraman\n' +
        '/bekor — ogohlantirishlarni o\'chirish',
      ),
    );

    this.bot.command('kurs', async (ctx) => {
      const arg = (ctx.message.text.split(/\s+/)[1] ?? '').toUpperCase();
      if (arg && findCorridor(arg)) {
        const result = await this.comparison.forCorridor(arg);
        await ctx.replyWithMarkdown(renderDailyPost(result));
        return;
      }
      const all = await this.comparison.allLive();
      await ctx.replyWithMarkdown(renderMultiCorridorPost(all));
    });

    this.bot.command('ogohlantir', async (ctx) => {
      const parts = ctx.message.text.split(/\s+/);
      const corridorId = (parts[1] ?? '').toUpperCase();
      const corridor = findCorridor(corridorId);
      if (!corridor) {
        await ctx.reply('Masalan: /ogohlantir KR-UZ 8600000');
        return;
      }
      const threshold = parseMinor(parts[2], corridor.recvCurrency);
      if (threshold === null) {
        await ctx.reply(`Masalan: /ogohlantir ${corridorId} 8600000`);
        return;
      }
      try {
        await this.alerts.subscribe(String(ctx.chat.id), corridorId, threshold);
        await ctx.reply(`Yaxshi. ${corridorId} uchun chegara belgilandi.`);
      } catch (e) {
        await ctx.reply(e instanceof Error ? e.message : 'Chegara qabul qilinmadi');
      }
    });

    this.bot.command('bekor', async (ctx) => {
      const n = await this.alerts.unsubscribe(String(ctx.chat.id));
      await ctx.reply(
        n > 0 ? "Ogohlantirishlar o'chirildi." : "Faol ogohlantirish yo'q edi.",
      );
    });

    void this.bot.launch();
    this.log.log('Chiroq boti ishga tushdi');
  }

  /** Har kuni 08:00 (Seul) — ishga ketish vaqti */
  @Cron('0 8 * * *', { timeZone: 'Asia/Seoul' })
  async postDaily(): Promise<void> {
    const channel = process.env.TELEGRAM_CHANNEL_ID;
    if (!this.bot || !channel) return;
    const all = await this.comparison.allLive();
    await this.bot.telegram.sendMessage(channel, renderMultiCorridorPost(all), {
      parse_mode: 'Markdown',
    });
    this.log.log('Kunlik post yuborildi');
  }

  /** Har 3 soatda chegaradan oshganlarni tekshiradi */
  @Cron('0 */3 * * *', { timeZone: 'Asia/Seoul' })
  async checkAlerts(): Promise<void> {
    if (!this.bot) return;
    let sent = 0;

    for (const result of await this.comparison.allLive()) {
      for (const hit of await this.alerts.due(result)) {
        try {
          await this.bot.telegram.sendMessage(
            hit.subscription.chatId,
            renderAlert(
              hit.displayName,
              hit.valueMinor,
              hit.subscription.thresholdMinor,
              hit.corridorId,
            ),
            { parse_mode: 'Markdown' },
          );
          await this.alerts.recordFired(hit);
          sent++;
        } catch {
          // Foydalanuvchi botni bloklagan bo'lishi mumkin — qolganlari davom etadi
          this.log.warn(`Ogohlantirish yuborilmadi: ${hit.subscription.chatId}`);
        }
      }
    }
    if (sent > 0) this.log.log(`${sent} ta ogohlantirish yuborildi`);
  }
}
