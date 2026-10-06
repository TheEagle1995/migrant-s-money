import { InboundEvent, Transfer, TransferStatus } from '../domain/types';

export interface NewInboundEvent {
  householdId: string;
  amountMinor: bigint;
  kind: 'CREDIT' | 'DEBIT';
  bankSlug: string;
  cardLast4?: string | null;
  merchant?: string | null;
  occurredAt: Date;
  confidence: number;
  parserVersion: number;
}

export interface TransferRepository {
  create(t: Omit<Transfer, 'id' | 'status'>): Promise<Transfer>;
  findById(id: string): Promise<Transfer | null>;
  findPending(householdId: string): Promise<Transfer[]>;
  markMatched(transferId: string, eventId: string, confirmedBy: string): Promise<void>;
  setStatus(transferId: string, status: TransferStatus): Promise<void>;
  expireOlderThan(cutoff: Date): Promise<number>;
}

export interface InboundEventRepository {
  create(e: NewInboundEvent): Promise<InboundEvent>;
  unmatchedCredits(householdId: string, from: Date, to: Date): Promise<InboundEvent[]>;
  recent(householdId: string, limit: number): Promise<InboundEvent[]>;
  findById(id: string): Promise<InboundEvent | null>;
}

export interface ConsentRepository {
  /** SMS rozilik berilganmi. Rozilik bo'lmasa hech qanday hodisa qabul qilinmaydi. */
  hasSmsConsent(householdId: string): Promise<boolean>;
}

export const TRANSFER_REPO = Symbol('TRANSFER_REPO');
export const EVENT_REPO = Symbol('EVENT_REPO');
export const CONSENT_REPO = Symbol('CONSENT_REPO');
