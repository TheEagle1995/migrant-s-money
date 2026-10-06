import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf } from 'telegraf';
import { ComparisonService } from '../rates/comparison.service';
import { renderDailyPost, renderAlert } from './message';
import { AlertsService } from './alerts.service';

/**
 * Faza 0 mahsuloti. App emas, bot.
 * Sabab: install friksiyasi nol va o'zbek jamoasi Telegram guruhlarida tarqatadi.
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
      this.log.warn('TELEGRAM_BOT_TOKEN yo\'q — bot ishga tushmadi');
      return;
    }
    this.bot = new Telegraf(token);

    this.bot.start((ctx) =>
      ctx.reply(
        'Salom! Har kuni ertalab Koreyadan O\'zbekistonga 1 mln KRW yuborganda ' +
        'qaysi kanal ko\'p so\'m yetkazishini yozib turaman.\n\n' +
        '/kurs — hozirgi holat\n' +
        '/ogohlantir 8600000 — kurs shu darajadan oshsa xabar beraman\n' +
        '/bekor — ogohlantirishlarni o\'chirish',
      ),
    );

    this.bot.command('kurs', async (ctx) => {
      const result = await this.comparison.current();
      await ctx.replyWithMarkdown(renderDailyPost(result));
    });

    this.bot.command('ogohlantir', async (ctx) => {
      const arg = ctx.message.text.split(/\s+/)[1];
      const value = arg ? BigInt(arg.replace(/\D/g, '') || '0') : 0n;
      try {
        await this.alerts.subscribe(String(ctx.chat.id), value);
        await ctx.reply(
          `Yaxshi. Kurs ${arg} so'mdan oshsa xabar beraman.\n` +
          `Bekor qilish: /bekor`,
        );
      } catch {
        await ctx.reply(
          'Chegarani so\'mda yozing — 1 mln KRW uchun.\nMasalan: /ogohlantir 8600000',
        );
      }
    });

    this.bot.command('bekor', async (ctx) => {
      const n = await this.alerts.unsubscribe(String(ctx.chat.id));
      await ctx.reply(n > 0 ? 'Ogohlantirishlar o\'chirildi.' : 'Faol ogohlantirish yo\'q edi.');
    });

    this.bot.command('ogohlantir', async (ctx) => {
      const arg = ctx.message.text.split(/\s+/)[1] ?? '';
      const digits = arg.replace(/[^0-9]/g, '');
      if (!digits) {
        await ctx.reply('Masalan: /ogohlantir 8600000');
        return;
      }
      try {
        await this.alerts.subscribe(String(ctx.chat.id), BigInt(digits));
        await ctx.reply(
          `Yaxshi. 1 mln KRW uchun ${digits} so'mdan oshsa xabar beraman.`,
        );
      } catch (e) {
        await ctx.reply(
          e instanceof Error ? e.message : 'Chegara qabul qilinmadi',
        );
      }
    });

    this.bot.command('bekor', async (ctx) => {
      const n = await this.alerts.unsubscribe(String(ctx.chat.id));
      await ctx.reply(
        n > 0 ? 'Ogohlantirishlar o\'chirildi.' : 'Faol ogohlantirish yo\'q edi.',
      );
    });

    void this.bot.launch();
    this.log.log('Telegram bot ishga tushdi');
  }

  /** Har kuni 08:00 (Seul) — ishga ketish vaqti */
  @Cron('0 8 * * *', { timeZone: 'Asia/Seoul' })
  async postDaily(): Promise<void> {
    const channel = process.env.TELEGRAM_CHANNEL_ID;
    if (!this.bot || !channel) return;
    const result = await this.comparison.current();
    await this.bot.telegram.sendMessage(channel, renderDailyPost(result), {
      parse_mode: 'Markdown',
    });
    this.log.log('Kunlik post yuborildi');
  }

  /** Har soatda chegaralarni tekshiradi. Spam'dan himoya alerts.service ichida. */
  @Cron('0 * * * *', { timeZone: 'Asia/Seoul' })
  async checkAlerts(): Promise<void> {
    if (!this.bot) return;
    const comparison = await this.comparison.current();
    const hits = await this.alerts.due(comparison);

    for (const hit of hits) {
      try {
        await this.bot.telegram.sendMessage(
          hit.subscription.chatId,
          renderAlert(hit.displayName, hit.valueMinor, hit.subscription.thresholdMinor),
          { parse_mode: 'Markdown' },
        );
        await this.alerts.recordFired(hit);
      } catch (e) {
        // Foydalanuvchi botni bloklagan bo'lishi mumkin — qolganlari davom etadi
        this.log.warn(`Alert yuborilmadi: ${hit.subscription.chatId}`);
      }
    }
    if (hits.length > 0) this.log.log(`${hits.length} ta ogohlantirish yuborildi`);
  }
}
