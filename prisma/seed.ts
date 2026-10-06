import { PrismaClient } from '@prisma/client';
import * as templates from '../src/parsers/parsers.seed.json';

const db = new PrismaClient();

const PROVIDERS = [
  { slug: 'toss', displayName: 'Toss', kind: 'BANK_APP' as const },
  { slug: 'sentbe', displayName: 'Sentbe', kind: 'SMALL_REMITTANCE' as const },
  { slug: 'hanpass', displayName: 'Hanpass', kind: 'SMALL_REMITTANCE' as const },
  { slug: 'gme', displayName: 'GME', kind: 'SMALL_REMITTANCE' as const },
  { slug: 'cross', displayName: 'Cross', kind: 'SMALL_REMITTANCE' as const },
  { slug: 'moin', displayName: 'Moin', kind: 'SMALL_REMITTANCE' as const },
  { slug: 'wirebarley', displayName: 'WireBarley', kind: 'SMALL_REMITTANCE' as const },
  { slug: 'keb-hana', displayName: 'KEB Hana Bank', kind: 'BANK' as const },
];

const CATEGORIES = [
  { slug: 'oziq-ovqat', nameUz: 'Oziq-ovqat' },
  { slug: 'kommunal', nameUz: 'Kommunal to\'lovlar' },
  { slug: 'talim', nameUz: 'Ta\'lim' },
  { slug: 'transport', nameUz: 'Transport' },
  { slug: 'kiyim', nameUz: 'Kiyim-kechak' },
  { slug: 'qarz', nameUz: 'Qarz to\'lash' },
  { slug: 'jamgarma', nameUz: 'Jamg\'arma' },
  { slug: 'boshqa', nameUz: 'Boshqa' },
];

async function main(): Promise<void> {
  for (const p of PROVIDERS) {
    await db.provider.upsert({
      where: { slug: p.slug },
      create: p,
      update: { displayName: p.displayName },
    });
  }
  for (const c of CATEGORIES) {
    await db.category.upsert({ where: { slug: c.slug }, create: c, update: {} });
  }
  const list = (templates as unknown as { default?: unknown[] }).default ?? templates;
  for (const t of list as Array<Record<string, unknown>>) {
    await db.parserTemplate.upsert({
      where: {
        bankSlug_version: { bankSlug: t.bankSlug as string, version: t.version as number },
      },
      create: {
        bankSlug: t.bankSlug as string,
        version: t.version as number,
        pattern: t.pattern as string,
        amountGroup: t.amountGroup as string,
        kindMap: t.kindMap as never,
      },
      update: {},
    });
  }
  console.log(`Seed: ${PROVIDERS.length} provayder, ${CATEGORIES.length} kategoriya`);
  console.log('DIQQAT: parser shablonlari TAXMIN. Real SMS matnlari bilan tekshiring.');
}

main().finally(() => db.$disconnect());
