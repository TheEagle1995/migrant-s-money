import { ComparisonResult } from '../rates/comparison.service';
import { formatMinor } from '../domain/money';

const MEDAL = ['🥇', '🥈', '🥉'];

/**
 * Telegram kunlik post. Faza 0 ning butun mahsuloti shu matn.
 * App emas — o'zbek migrantlar Telegram guruhlarida yashaydi, install friksiyasi nol.
 */
export function renderDailyPost(r: ComparisonResult, date: Date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  if (r.rows.length === 0) {
    return `📊 ${d}\n\nBugun ma'lumot yig'ilmadi. Ertaga qayta urinamiz.`;
  }

  const lines = [
    `📊 *1 000 000 KRW yuborsangiz qancha so'm keladi*`,
    `_${d}_`,
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
      `${medal} *${row.displayName}* — ${formatMinor(row.recvPerMillionKrw)} so'm${gap}` +
      (flags ? `\n     _${flags}_` : ''),
    );
  });

  if (r.best && r.worst && r.rows.length > 1) {
    lines.push('');
    lines.push(
      `💡 Eng yaxshi va eng yomon orasidagi farq: *${(r.spread * 100).toFixed(1)}%*`,
    );
    lines.push(
      `Yiliga 12 o'tkazmada: *${formatMinor(r.annualLossMinor)} so'm* farq qiladi.`,
    );
  }

  lines.push('');
  lines.push('_Tartib faqat qo\'lga tekkan summa bo\'yicha. Reklama o\'rni sotilmaydi._');
  return lines.join('\n');
}

/** Kurs ma'lum chegaradan oshganda yuboriladigan xabar */
export function renderAlert(providerName: string, value: bigint, threshold: bigint): string {
  return (
    `🔔 *${providerName}* kursi ko'tarildi\n\n` +
    `1 mln KRW → *${formatMinor(value)} so'm*\n` +
    `Sizning chegarangiz: ${formatMinor(threshold)} so'm`
  );
}
