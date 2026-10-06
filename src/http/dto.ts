import { z } from 'zod';

/** So'm/won butun son sifatida keladi, string bo'lib — JSON'da BigInt yo'q. */
const minor = z
  .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
  .transform((v) => BigInt(v));

export const declareTransferSchema = z.object({
  householdId: z.string().min(1),
  providerSlug: z.string().min(1).optional(),
  sentMinor: minor,
  declaredAt: z.coerce.date().optional(),
});
export type DeclareTransferDto = z.infer<typeof declareTransferSchema>;

export const ingestEventSchema = z.object({
  householdId: z.string().min(1),
  amountMinor: minor,
  kind: z.enum(['CREDIT', 'DEBIT']),
  bankSlug: z.string().min(1),
  cardLast4: z.string().length(4).optional(),
  merchant: z.string().max(80).optional(),
  occurredAt: z.coerce.date(),
  confidence: z.number().min(0).max(1),
  parserVersion: z.number().int().positive(),
});
export type IngestEventDto = z.infer<typeof ingestEventSchema>;

export const confirmMatchSchema = z.object({
  transferId: z.string().min(1),
  eventId: z.string().min(1),
});

export const manualImportSchema = z.object({
  rows: z.array(
    z.object({
      providerSlug: z.string().min(1),
      sendMinor: minor,
      feeMinor: minor,
      recvMinor: minor,
      recvBank: z.string().optional(),
      payoutMethod: z.enum(['CARD', 'ACCOUNT', 'CASH_PICKUP']).optional(),
      etaMinutes: z.number().int().nonnegative().optional(),
      isPromotional: z.boolean().default(false),
      measuredAt: z.coerce.date(),
    }),
  ),
});

/** BigInt JSON'ga serializatsiya qilinmaydi — qo'lda string'ga aylantiramiz. */
export function jsonSafe<T>(value: T): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}

export const createGoalSchema = z.object({
  householdId: z.string().min(1),
  title: z.string().min(1).max(80),
  targetMinor: minor,
  dueDate: z.coerce.date().optional(),
});

export const contributeSchema = z.object({
  goalId: z.string().min(1),
  amountMinor: minor,
});
