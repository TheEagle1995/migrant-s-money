import { ComparisonResult } from '../rates/comparison.service';
import { formatMinor, currency } from '../domain/currency';
import { COUNTRIES, findCorridor } from '../domain/corridor';

const MEDAL = ['🥇', '🥈', '🥉'];

/**
 * Telegram kunlik post. Faza 0 ning butun mahsuloti shu matn — o'zbek
 * migrantlar Telegram guruhlarida yashaydi, install friksiyasi nol.
 *
 * Koridor nomi sarlavhada ko'rsatiladi, chunki bitta kanalda bir nechta
 * koridor posti chiqadi va o'quvchi o'ziga tegishlisini darhol topishi kerak.
 */
export function renderDailyPost(r: ComparisonResult, date: Date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  const c = findCorridor(r.corridorId);
  const flagFrom = c ? COUNTRIES[c.send].flag : '';
  const flagTo = c ? COUNTRIES[c.recv].flag : '';
  const sendSym = currency(r.sendCurrency).symbol;

  if (r.rows.length === 0) {
    return (
      `${flagFrom}${flagTo} *${r.corridorLabel}*\n_${d}_\n\n` +
      `Bu koridor uchun hali o'lchov kiritilmagan.`
    );
  }

  const lines = [
    `${flagFrom}${flagTo} *${r.baseSendFormatted} ${sendSym} yuborsangiz qancha keladi*`,
    `_${r.corridorLabel} · ${d}_`,
    '',
  ];

  r.rows.forEach((row, i) => {
    const medal = MEDAL[i] ?? `${row.rank}.`;
    const gap = i === 0 ? '' : `  (${(row.gapFromBest * 100).toFixed(1)}%)`;
    const flags = [
      row.isPromotional ? '🎁 promo' : '',
      row.isStale ? `⏳ ${row.staleHours} soat oldin` : '',
    ].filter(Boolean).join(', ');
    lines.push(
      `${medal} *${row.displayName}* — ${row.recvFormatted} ${currency(r.recvCurrency).symbol}${gap}` +
      (flags ? `\n     _${flags}_` : ''),
    );
  });

  if (r.best && r.worst && r.rows.length > 1) {
    lines.push('');
    lines.push(`💡 Eng yaxshi va eng yomon orasidagi farq: *${(r.spread * 100).toFixed(1)}%*`);
    lines.push(
      `Yiliga 12 o'tkazmada: *${formatMinor(r.annualLossMinor, r.recvCurrency)} ` +
      `${currency(r.recvCurrency).symbol}* farq qiladi.`,
    );
  }

  lines.push('');
  lines.push("_Tartib faqat qo'lga tekkan summa bo'yicha. Reklama o'rni sotilmaydi._");
  return lines.join('\n');
}

/** Bir nechta koridorni bitta postda — kanalga kunlik xulosa */
export function renderMultiCorridorPost(
  results: ComparisonResult[],
  date: Date = new Date(),
): string {
  const withData = results.filter((r) => r.rows.length > 0);
  if (withData.length === 0) {
    return `📊 _${date.toISOString().slice(0, 10)}_\n\nBugun ma'lumot yig'ilmadi.`;
  }

  const lines = [`📊 *Bugungi eng yaxshi kurslar*`, `_${date.toISOString().slice(0, 10)}_`, ''];

  for (const r of withData) {
    const c = findCorridor(r.corridorId);
    const flags = c ? `${COUNTRIES[c.send].flag}${COUNTRIES[c.recv].flag}` : '';
    const best = r.best!;
    lines.push(
      `${flags} *${r.baseSendFormatted} ${currency(r.sendCurrency).symbol}* → ` +
      `${best.recvFormatted} ${currency(r.recvCurrency).symbol}`,
    );
    lines.push(`     ${best.displayName}${r.rows.length > 1 ? `, farq ${(r.spread * 100).toFixed(1)}%` : ''}`);
  }

  lines.push('');
  lines.push('To\'liq ro\'yxat: /kurs');
  return lines.join('\n');
}

/** Kurs chegaradan oshganda yuboriladigan xabar */
export function renderAlert(
  providerName: string,
  valueMinor: bigint,
  thresholdMinor: bigint,
  corridorId: string,
): string {
  const c = findCorridor(corridorId);
  const recv = c?.recvCurrency ?? 'UZS';
  const sym = currency(recv).symbol;
  const head = c
    ? `${COUNTRIES[c.send].flag}${COUNTRIES[c.recv].flag} ${c.id}`
    : corridorId;
  return (
    `🔔 *${providerName}* kursi ko'tarildi\n_${head}_\n\n` +
    `${c ? `${formatMinor(c.baseSendMinor, c.sendCurrency)} ${currency(c.sendCurrency).symbol} → ` : ''}` +
    `*${formatMinor(valueMinor, recv)} ${sym}*\n` +
    `Sizning chegarangiz: ${formatMinor(thresholdMinor, recv)} ${sym}`
  );
}
