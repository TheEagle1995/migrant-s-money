import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AlertRepository, AlertSubscription } from '../../bot/alerts.service';

@Injectable()
export class PrismaAlertRepo implements AlertRepository {
  constructor(private readonly db: PrismaService) {}

  create(
    s: Omit<AlertSubscription, 'id' | 'lastFiredValueMinor' | 'isActive'>,
  ): Promise<AlertSubscription> {
    return this.db.alertSubscription.create({
      data: s as never,
    }) as unknown as Promise<AlertSubscription>;
  }

  listActive(): Promise<AlertSubscription[]> {
    return this.db.alertSubscription.findMany({
      where: { isActive: true },
    }) as unknown as Promise<AlertSubscription[]>;
  }

  async markFired(id: string, value: bigint): Promise<void> {
    await this.db.alertSubscription.update({
      where: { id },
      data: { lastFiredValueMinor: value },
    });
  }

  async deactivateForChat(chatId: string): Promise<number> {
    const r = await this.db.alertSubscription.updateMany({
      where: { chatId, isActive: true },
      data: { isActive: false },
    });
    return r.count;
  }
}
