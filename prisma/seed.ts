import { PrismaClient } from '@prisma/client';
import banksSeed from '../src/parsers/banks.seed.json';
import templatesSeed from '../src/parsers/parsers.seed.json';
import { CORRIDORS } from '../src/domain/corridor';

const db = new PrismaClient();

import providersSeed from './providers.seed.json';

const PROVIDERS = providersSeed as Array<{
  slug: string;
  displayName: string;
  kind: string;
  sendCountries: string[];
  payouts: string[];
  funding: string[];
}>;

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
      update: {
        displayName: p.displayName,
        sendCountries: p.sendCountries,
        payouts: p.payouts,
        funding: p.funding,
      } as never,
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
  const countries = new Set(CORRIDORS.flatMap((c) => [c.send, c.recv]));
  console.log(
    `Seed: ${PROVIDERS.length} provayder, ${(banksSeed as unknown[]).length} bank, ` +
    `${CATEGORIES.length} kategoriya, ${live}/${CORRIDORS.length} faol koridor, ` +
    `${countries.size} davlat`,
  );
  console.log('');
  console.log('DIQQAT: parser shablonlari TAXMIN — real SMS matnlari bilan tekshiring.');
  console.log('DIQQAT: koridor sanity oraliqlari keng to\'siq, narx emas.');
}

main().finally(() => db.$disconnect());
