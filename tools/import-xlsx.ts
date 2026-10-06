/**
 * O'lchov jadvalini backendga yuklash.
 *
 *   npx ts-node tools/import-xlsx.ts ./otkazma-olchov.xlsx [--dry]
 *
 * "Olchov" varag'idagi to'ldirilgan qatorlarni o'qiydi va /rates/import ga yuboradi.
 * "Namuna" varag'i ATAYLAB o'qilmaydi — undagi raqamlar o'ylab topilgan.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const SHEET = 'Olchov';
const ENDPOINT = process.env.API_URL ?? 'http://localhost:3000/rates/import';

/** Jadvaldagi kanal nomi -> DB slug */
const SLUGS: Record<string, string> = {
  toss: 'toss',
  sentbe: 'sentbe',
  hanpass: 'hanpass',
  gme: 'gme',
  cross: 'cross',
  moin: 'moin',
  wirebarley: 'wirebarley',
  'bank (keb)': 'keb-hana',
  keb: 'keb-hana',
};

interface Row {
  providerSlug: string;
  sendMinor: string;
  feeMinor: string;
  recvMinor: string;
  recvBank?: string;
  etaMinutes?: number;
  isPromotional: boolean;
  measuredAt: string;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[\s\u00A0,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    // Excel serial sana
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function extractRows(sheet: XLSX.WorkSheet): { rows: Row[]; skipped: string[] } {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 1,
    range: 3, // 4-qator sarlavha
    blankrows: false,
  }) as unknown as unknown[][];

  const rows: Row[] = [];
  const skipped: string[] = [];

  // 0:sana 1:kanal 2:yuborildi 3:komissiya 4:kurs 5:qo'lga tegdi 6:bank 7:soat 8:promo
  raw.slice(1).forEach((r, i) => {
    const lineNo = i + 5;
    const name = String(r[1] ?? '').trim();
    if (!name) return;

    const slug = SLUGS[name.toLowerCase()];
    if (!slug) {
      skipped.push(`${lineNo}-qator: noma'lum kanal "${name}"`);
      return;
    }
    const sent = toNumber(r[2]);
    const recv = toNumber(r[5]);
    const date = toDate(r[0]);
    if (sent === null || recv === null) {
      skipped.push(`${lineNo}-qator: summa to'ldirilmagan`);
      return;
    }
    if (!date) {
      skipped.push(`${lineNo}-qator: sana o'qilmadi`);
      return;
    }
    rows.push({
      providerSlug: slug,
      sendMinor: String(Math.round(sent)),
      feeMinor: String(Math.round(toNumber(r[3]) ?? 0)),
      recvMinor: String(Math.round(recv)),
      recvBank: r[6] ? String(r[6]) : undefined,
      etaMinutes: r[7] != null ? Math.round((toNumber(r[7]) ?? 0) * 60) : undefined,
      isPromotional: /ha|yes|ha'/i.test(String(r[8] ?? '')),
      measuredAt: date.toISOString(),
    });
  });

  return { rows, skipped };
}

async function main(): Promise<void> {
  const file = process.argv[2];
  const dry = process.argv.includes('--dry');
  if (!file) {
    console.error('Foydalanish: ts-node tools/import-xlsx.ts <fayl.xlsx> [--dry]');
    process.exit(1);
  }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    console.error(`Fayl topilmadi: ${abs}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(abs);
  if (!wb.SheetNames.includes(SHEET)) {
    console.error(`"${SHEET}" varag'i topilmadi. Varaqlar: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }

  const { rows, skipped } = extractRows(wb.Sheets[SHEET]);

  skipped.forEach((s) => console.warn(`  ⚠ ${s}`));
  console.log(`O'qildi: ${rows.length} qator`);
  rows.forEach((r) => {
    const rate = Number(r.recvMinor) / Number(r.sendMinor);
    console.log(
      `  ${r.providerSlug.padEnd(12)} ${Number(r.recvMinor).toLocaleString('ru-RU')} so'm` +
        `  (kurs ${rate.toFixed(4)})${r.isPromotional ? '  [promo]' : ''}`,
    );
  });

  if (rows.length === 0) {
    console.error('\nYuklanadigan qator yo\'q. Jadval to\'ldirilganmi?');
    process.exit(1);
  }
  if (dry) {
    console.log('\n--dry: yuborilmadi.');
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ADMIN_API_KEY ?? '',
    },
    body: JSON.stringify({ rows }),
  });
  console.log(`\n${res.status} ${res.statusText}`);
  console.log(await res.text());
}

if (require.main === module) {
  void main();
}
