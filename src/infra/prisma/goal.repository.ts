import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Goal, GoalRepository } from '../../household/goals.service';

@Injectable()
export class PrismaGoalRepo implements GoalRepository {
  constructor(private readonly db: PrismaService) {}

  create(g: Omit<Goal, 'id' | 'createdAt' | 'savedMinor'>): Promise<Goal> {
    return this.db.goal.create({ data: g as never }) as unknown as Promise<Goal>;
  }

  findById(id: string): Promise<Goal | null> {
    return this.db.goal.findUnique({ where: { id } }) as unknown as Promise<Goal | null>;
  }

  listByHousehold(householdId: string): Promise<Goal[]> {
    return this.db.goal.findMany({
      where: { householdId },
      orderBy: { createdAt: 'asc' },
    }) as unknown as Promise<Goal[]>;
  }

  /** Atomik increment — parallel hissalar bir-birini yo'qotmasin */
  addSaved(id: string, deltaMinor: bigint): Promise<Goal> {
    return this.db.goal.update({
      where: { id },
      data: { savedMinor: { increment: deltaMinor } },
    }) as unknown as Promise<Goal>;
  }
}
