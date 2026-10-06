import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

export interface Goal {
  id: string;
  householdId: string;
  title: string;
  targetMinor: bigint;
  savedMinor: bigint;
  dueDate: Date | null;
  createdAt: Date;
}

export interface GoalRepository {
  create(g: Omit<Goal, 'id' | 'createdAt' | 'savedMinor'>): Promise<Goal>;
  findById(id: string): Promise<Goal | null>;
  listByHousehold(householdId: string): Promise<Goal[]>;
  addSaved(id: string, deltaMinor: bigint): Promise<Goal>;
}

export const GOAL_REPO = Symbol('GOAL_REPO');

export interface GoalProgress {
  goal: Goal;
  /** 0..1 oralig'ida, 1 dan oshmaydi */
  ratio: number;
  remainingMinor: bigint;
  isComplete: boolean;
  daysLeft: number | null;
  /** Muddatga yetish uchun oyiga qancha kerak. Muddat yo'q bo'lsa null. */
  requiredPerMonthMinor: bigint | null;
}

/** Sof funksiya — testlanadi, DB kerak emas. */
export function progressOf(goal: Goal, now: Date = new Date()): GoalProgress {
  const target = goal.targetMinor;
  const saved = goal.savedMinor < 0n ? 0n : goal.savedMinor;
  const remaining = target > saved ? target - saved : 0n;
  const ratio = target === 0n ? 0 : Math.min(1, Number(saved) / Number(target));

  let daysLeft: number | null = null;
  let requiredPerMonthMinor: bigint | null = null;

  if (goal.dueDate) {
    const ms = goal.dueDate.getTime() - now.getTime();
    daysLeft = Math.ceil(ms / 86_400_000);
    if (remaining > 0n && daysLeft > 0) {
      const months = BigInt(Math.max(1, Math.ceil(daysLeft / 30)));
      requiredPerMonthMinor = remaining / months;
    }
  }

  return {
    goal,
    ratio,
    remainingMinor: remaining,
    isComplete: remaining === 0n && target > 0n,
    daysLeft,
    requiredPerMonthMinor,
  };
}

@Injectable()
export class GoalsService {
  constructor(@Inject(GOAL_REPO) private readonly repo: GoalRepository) {}

  async create(input: {
    householdId: string;
    title: string;
    targetMinor: bigint;
    dueDate?: Date | null;
  }): Promise<Goal> {
    if (input.targetMinor <= 0n) {
      throw new BadRequestException('Maqsad summasi musbat bo\'lishi kerak');
    }
    if (!input.title.trim()) {
      throw new BadRequestException('Maqsad nomi bo\'sh');
    }
    return this.repo.create({
      householdId: input.householdId,
      title: input.title.trim(),
      targetMinor: input.targetMinor,
      dueDate: input.dueDate ?? null,
    });
  }

  async list(householdId: string): Promise<GoalProgress[]> {
    const goals = await this.repo.listByHousehold(householdId);
    return goals.map((g) => progressOf(g));
  }

  /**
   * Maqsadga hissa qo'shish. Oila a'zosi o'zi belgilaydi —
   * avtomatik emas, chunki har kirim maqsadga ketmaydi.
   */
  async contribute(goalId: string, deltaMinor: bigint): Promise<GoalProgress> {
    if (deltaMinor <= 0n) throw new BadRequestException('Summa musbat bo\'lishi kerak');
    const existing = await this.repo.findById(goalId);
    if (!existing) throw new NotFoundException('Maqsad topilmadi');
    const updated = await this.repo.addSaved(goalId, deltaMinor);
    return progressOf(updated);
  }
}
