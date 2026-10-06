import { PrismaClient } from '@prisma/client';
import banksSeed from '../src/parsers/banks.seed.json';
import templatesSeed from '../src/parsers/parsers.seed.json';
import { CORRIDORS } from '../src/domain/corridor';

const db = new PrismaClient();

type Kind = 'SMALL_REMITTANCE' | 'BANK_APP' | 'BANK' | 'WALLET';

/**
 * Provayderlar koridor bo'yicha. Har biri qaysi davlatdan yuborilishini
 * aytadi — shuning uchun Sentbe (Koreya) va Korona (Rossiya) bitta
 * ro'yxatda chiqib qolmaydi.
 */
const PROVIDERS: Array<{
  slug: string;
  displayName: string;
  kind: Kind;
  sendCountries: string[];
  isLicensed?: boolean;
}> = [
  // --- Koreya ---
  { slug: 'toss',       displayName: 'Toss',           kind: 'BANK_APP',         sendCountries: ['KR'] },
  { slug: 'sentbe',     displayName: 'Sentbe',         kind: 'SMALL_REMITTANCE', sendCountries: ['KR'] },
  { slug: 'hanpass',    displayName: 'Hanpass',        kind: 'SMALL_REMITTANCE', sendCountries: ['KR'] },
  { slug: 'gme',        displayName: 'GME',            kind: 'SMALL_REMITTANCE', sendCountries: ['KR'] },
  { slug: 'cross',      displayName: 'Cross',          kind: 'SMALL_REMITTANCE', sendCountries: ['KR'] },
  { slug: 'moin',       displayName: 'Moin',           kind: 'SMALL_REMITTANCE', sendCountries: ['KR'] },
  { slug: 'wirebarley', displayName: 'WireBarley',     kind: 'SMALL_REMITTANCE', sendCountries: ['KR'] },
  { slug: 'e9pay',      displayName: 'E9pay',          kind: 'SMALL_REMITTANCE', sendCountries: ['KR'] },
  { slug: 'keb-hana',   displayName: 'KEB Hana Bank',  kind: 'BANK',             sendCountries: ['KR'] },

  // --- Rossiya ---
  { slug: 'korona',     displayName: 'Korona Pay',     kind: 'WALLET',           sendCountries: ['RU'] },
  { slug: 'unistream',  displayName: 'Unistream',      kind: 'WALLET',           sendCountries: ['RU'] },
  { slug: 'contact',    displayName: 'Contact',        kind: 'WALLET',           sendCountries: ['RU'] },
  { slug: 'sber-remit', displayName: 'Sberbank',       kind: 'BANK',             sendCountries: ['RU'] },
  { slug: 'tbank-remit',displayName: 'T-Bank',         kind: 'BANK_APP',         sendCountries: ['RU'] },

  // --- Qozog'iston ---
  { slug: 'kaspi-remit',displayName: 'Kaspi',          kind: 'BANK_APP',         sendCountries: ['KZ'] },
  { slug: 'halyk-remit',displayName: 'Halyk Bank',     kind: 'BANK',             sendCountries: ['KZ'] },

  // --- AQSh / Turkiya / BAA: global operatorlar ---
  { slug: 'wise',       displayName: 'Wise',           kind: 'SMALL_REMITTANCE', sendCountries: ['US', 'TR', 'AE', 'PL'] },
  { slug: 'remitly',    displayName: 'Remitly',        kind: 'SMALL_REMITTANCE', sendCountries: ['US', 'AE'] },
  { slug: 'western-union', displayName: 'Western Union', kind: 'WALLET',         sendCountries: ['US', 'TR', 'AE', 'RU', 'KZ'] },
  { slug: 'moneygram',  displayName: 'MoneyGram',      kind: 'WALLET',           sendCountries: ['US', 'TR', 'AE'] },
  { slug: 'ria',        displayName: 'Ria',            kind: 'WALLET',           sendCountries: ['US', 'TR'] },
];

const CATEGORIES = [
  { slug: 'oziq-ovqat', nameUz: 'Oziq-ovqat' },
  { slug: 'kommunal',   nameUz: "Kommunal to'lovlar" },
  { slug: 'talim',      nameUz: "Ta'lim" },
  { slug: 'transport',  nameUz: 'Transport' },
  { slug: 'kiyim',      nameUz: 'Kiyim-kechak' },
  { slug: 'qarz',       nameUz: "Qarz to'lash" },
  { slug: 'jamgarma',   nameUz: "Jamg'arma" },
  { slug: 'boshqa',     nameUz: 'Boshqa' },
];

async function main(): Promise<void> {
  for (const p of PROVIDERS) {
    await db.provider.upsert({
      where: { slug: p.slug },
      create: p as never,
      update: { displayName: p.displayName, sendCountries: p.sendCountries } as never,
    });
  }

  for (const b of banksSeed as Array<Record<string, unknown>>) {
    await db.bank.upsert({
      where: { slug: b.slug as string },
      create: b as never,
      update: { name: b.name, smsSenders: b.smsSenders } as never,
    });
  }

  for (const c of CATEGORIES) {
    await db.category.upsert({ where: { slug: c.slug }, create: c, update: {} });
  }

  for (const t of templatesSeed as Array<Record<string, unknown>>) {
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

  const live = CORRIDORS.filter((c) => c.isLive).length;
  console.log(
    `Seed: ${PROVIDERS.length} provayder, ${(banksSeed as unknown[]).length} bank, ` +
    `${CATEGORIES.length} kategoriya, ${live}/${CORRIDORS.length} faol koridor`,
  );
  console.log('');
  console.log('DIQQAT: parser shablonlari TAXMIN — real SMS matnlari bilan tekshiring.');
  console.log('DIQQAT: koridor sanity oraliqlari keng to\'siq, narx emas.');
}

main().finally(() => db.$disconnect());
