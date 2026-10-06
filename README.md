# Chiroq

**Pul o'tkazmalarining yashirin narxini ko'rsatadi.**

Migrant oilalar uchun: qaysi kanal orqali yuborsa, uyga ko'proq pul yetadi —
va yuborilgan pul maqsadga qancha yig'ilgani.

NestJS + Prisma + PostgreSQL · Telegram bot · Flutter (Android)

**APK olish: [APK.md](APK.md)** — GitHub Actions quradi, lokal SDK kerak emas.
**Audit: [AUDIT.md](AUDIT.md)** — ko'p davlatga o'tishda topilgan xatolar.

```bash
npm install
cp .env.example .env
docker compose up -d db
npx prisma generate && npx prisma migrate dev --name init && npm run db:seed
npm test
npm run start:dev
```

---

## Nomi nega Chiroq

Mahsulotning butun tezisi: o'tkazmaning haqiqiy narxi komissiyada emas,
**kursda yashiringan**. Operatorlar "komissiya 0" deb reklama qiladi, lekin
pul kursda olinadi. Chiroq shu yashirin narxni yoritadi.

O'zak mintaqada tanish: *chiroq* (o'zbek, tojik), *чырак* (qirg'iz),
*шырақ* (qozoq).

---

## Holat

| Qism | Holat |
|---|---|
| Valyuta qatlami (ISO 4217 kasrlari) | ✅ 23 test |
| Koridor registri (10 koridor, 7 faol) | ✅ |
| Taqqoslash va reyting | ✅ 13 test |
| Moslashtirish (Transfer ↔ SMS) | ✅ 11 test |
| SMS parser — 24 bank, 6 davlat | ✅ 22 test |
| Maqsadlar | ✅ 6 test |
| Kurs ogohlantirishlari | ✅ 14 test |
| To'liq oqim integratsiyasi | ✅ 15 test |
| Telegram bot (ko'p koridor) | ✅ 10 test |
| HTTP API | ✅ typecheck toza |
| Prisma repozitoriylari | ✅ `prisma generate` kerak |
| xlsx import CLI | ✅ real jadval bilan sinaldi |
| Flutter klient | ⚠️ kompilyatsiya qilinmagan (SDK yo'q edi) |
| Android SMS receiver | ⚠️ qurilmada sinalmagan |
| Avtomatik kurs adapterlari | ❌ **yo'q — sababi quyida** |

`npm test` → **133 test**. `npx tsc --noEmit` → 0 xato.

---

## Koridorlar

| Koridor | Baza | Sanity oraliq |
|---|---|---|
| 🇰🇷 → 🇺🇿 | 1 000 000 KRW | 4–20 so'm |
| 🇷🇺 → 🇺🇿 | 50 000 RUB | 60–400 |
| 🇰🇿 → 🇺🇿 | 500 000 KZT | 8–60 |
| 🇺🇸 → 🇺🇿 | 1 000 USD | 7 000–20 000 |
| 🇹🇷 → 🇺🇿 | 10 000 TRY | 100–900 |
| 🇦🇪 → 🇺🇿 | 5 000 AED | 1 800–5 500 |
| 🇵🇱 → 🇺🇿 | 10 000 PLN | sinalmagan |

Sanity oraliqlar **narx emas** — faqat kiritish xatosini tutish uchun keng
to'siq. Masalan so'm o'rniga ming so'm yozilsa darhol ushlanadi.

Yangi koridor qo'shish: `src/domain/corridor.ts` ga bitta qator, provayderlarni
seed'ga, banklarni `banks.seed.json` ga. Kodning boshqa hech bir joyi
tegilmaydi — audit shuni ta'minlash uchun qilingan.

---

## Nima uchun avtomatik adapter yo'q

Toss, Sentbe, Hanpass, GME — hammasi kursni faqat ilova ichida, login va
외국인등록증 tekshiruvidan keyin ko'rsatadi. Ochiq HTTP endpoint topilmadi.

`PROVIDER_ADAPTERS` bo'sh massiv, ma'lumot `ManualImportService` orqali kiradi —
lekin `Quote` shakli avtomatik adapterlar bilan **bir xil**, ya'ni adapter
paydo bo'lganda faqat massivga qo'shiladi.

Huquqiy jihatdan toza rasmiy manba: **portal.kfb.or.kr** (은행연합회 소비자포털) —
banklar komissiya va kurslarini u yerda rasman e'lon qiladi. Faqat banklarni
qoplaydi, 소액송금업체 larni emas. `QuoteSource.OFFICIAL`.

## Ish oqimi (Faza 0)

```
otkazma-olchov.xlsx to'ldiriladi
        ↓
npx ts-node tools/import-xlsx.ts ./otkazma-olchov.xlsx --corridor KR-UZ --dry
npx ts-node tools/import-xlsx.ts ./otkazma-olchov.xlsx --corridor KR-UZ
        ↓
GET /rates/compare  →  Telegram kunlik post (08:00 Seul)
```

CLI jadvaldagi major qiymatni valyuta kasriga ko'ra minorga o'tkazadi va
koridor oralig'idan chiqqan qatorni rad etadi.

---

## Asosiy dizayn qarorlari

**Domen Prisma'dan mustaqil.** Repozitoriy portlari orqali — mantiq DB'siz
test qilinadi, Prisma adapter sifatida almashtiriladi.

**`Quote` append-only.** `QuoteRepository` da `update` metodi ataylab yo'q.
Joriy kurs = `DISTINCT ON (providerId) ... ORDER BY fetchedAt DESC`.

**Pul — BigInt minor unit + valyuta kodi.** Har bir valyuta o'z ISO 4217
kasriga ega. Turli valyutalarni qo'shish runtime'da yiqiladi.

**Ranking faqat qo'lga tekkan summa bo'yicha.** `Provider.affiliateActive`
maydoni bor, lekin `buildComparison()` da ishlatilmaydi — bunga alohida test
yozilgan. Bir marta jamoada "falonchi yaxshi to'laydi, uni birinchi qo'ygan"
degan gap tarqalsa, Telegram guruhlaridagi obro' bir kunda tugaydi — va butun
distribusiya o'sha guruhlarda.

**Eskirgan kotirovka yashirilmaydi.** 6 soatdan eski bo'lsa `isStale` va
`staleHours` bilan qaytadi. Jim eskirgan raqam ishonchni bir marta va butunlay
o'ldiradi.

**Moslashtirish deterministik.** Bir nechta nomzod yoki past parser ishonchi →
`ASK_USER`. Har bir tasdiqlangan moslik `QuoteSource.OBSERVED` bo'lib yoziladi —
bu reklama qilingan emas, **real qo'lga tekkan** kurs, va scraping bilan
takrorlanmaydi. Moat shu.

**Roziliksiz hech narsa qabul qilinmaydi.** `ingest()` avval
`hasSmsConsent()` ni tekshiradi, aks holda 403.

**Raw SMS serverga chiqmaydi.** Kotlin receiver xom matnni faqat Dart tomoniga
uzatadi; parsing qurilmada; API'ga `{amount, currency, kind, bank, occurredAt,
confidence}` ketadi.

**Offline navbat.** Bank SMS'i bir marta keladi. Parse natijasi avval diskka
yoziladi, keyin yuboriladi. 4xx javobda tashlanadi (server hech qachon qabul
qilmaydi), 5xx da saqlanadi.

---

## Sen bajarishing kerak bo'lgan ishlar

1. **Kurslarni o'lchash** — `otkazma-olchov.xlsx`. Buni men qila olmayman.
   Natija 1% dan kichik bo'lsa `rates` modulini o'chirib, faqat `household`
   bilan davom et.
2. **`prisma generate` + `migrate`** — bu muhitda Prisma engine binarilari
   bloklangan edi (`binaries.prisma.sh` 403).
3. **Real SMS matnlari** — `parsers.seed.json` dagi shablonlar **taxmin**.
   Versiyani oshirib qayta yoz, eskisini `isActive` qoldir.
4. **`flutter create .`** — `mobile/tool/apply_android_overrides.sh` platforma
   fayllarini qaytaradi.
5. **Play Store deklaratsiyasi** — Manifest'da ataylab faqat `RECEIVE_SMS`,
   `READ_SMS` emas.
6. **Telegram bot tokeni** — `.env` da.

## Hal qilinmagan strategik savol

Agar Toss chindan mid-market kurs bersa, Koreya koridorida javob doim "Toss"
bo'ladi va taqqoslash keraksiz. Bu yomon natija emas — byudjet qismi baribir
kuchliroq g'oya, chunki taqqoslash bir martalik qidiruv, byudjet esa har oyda
takrorlanadi. Birinchi o'lchov shuni hal qiladi.
