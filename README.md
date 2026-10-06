# Remit — Koreya → O'zbekiston o'tkazma taqqoslash + oilaviy byudjet

**APK olish: [APK.md](APK.md)** — GitHub Actions quradi, lokal SDK kerak emas.

NestJS + Prisma + PostgreSQL backend, Telegram bot, Flutter (Android) klient.

```
npm install
cp .env.example .env
docker compose up -d db
npx prisma generate && npx prisma migrate dev --name init && npm run db:seed
npm test          # 45 test
npm run start:dev
```

---

## Holat

| Qism | Holat |
|---|---|
| Domen modeli (Prisma schema) | ✅ tayyor |
| Taqqoslash va reyting mantig'i | ✅ tayyor, 11 test |
| Moslashtirish (Transfer ↔ SMS) | ✅ tayyor, 11 test |
| SMS parser + versiyalangan shablonlar | ✅ tayyor, 9 test |
| Pul arifmetikasi (BigInt) | ✅ tayyor, 5 test |
| Telegram post rendering | ✅ tayyor, 4 test |
| Import validatsiyasi | ✅ tayyor, 5 test |
| Maqsadlar (Goal) — progress, oylik hisob | ✅ tayyor, 6 test |
| Kurs ogohlantirishlari (Telegram) | ✅ tayyor, 9 test |
| **To'liq oqim integratsiya testi** | ✅ **12 test — import→taqqoslash→SMS→OBSERVED→tasdiqlash** |
| HTTP API (Nest controllers) | ✅ yozilgan, typecheck toza |
| Prisma repozitoriylari | ✅ yozilgan, `prisma generate` kerak |
| xlsx import CLI | ✅ ishlaydi (real jadval bilan sinaldi) |
| Flutter klient + SMS pipeline | ⚠️ yozilgan, **kompilyatsiya qilinmagan** |
| Android receiver + Manifest + MainActivity | ⚠️ yozilgan, **qurilmada sinalmagan** |
| Avtomatik kurs adapterlari | ❌ **yo'q — sababi quyida** |

`npm test` → **72 ta test** o'tadi. `npx tsc --noEmit` → 0 xato.

---

## Nima uchun avtomatik adapter yo'q

Toss, Sentbe, Hanpass, GME, Cross — hammasi kursni faqat ilova ichida, login va
외국인등록증 tekshiruvidan keyin ko'rsatadi. Ochiq HTTP endpoint topilmadi.

Shuning uchun `PROVIDER_ADAPTERS` bo'sh massiv, va ma'lumot `ManualImportService`
orqali kiradi — lekin `Quote` shakli avtomatik adapterlar bilan **bir xil**.
Faza 1 ga o'tganda hech narsa ko'chirilmaydi, faqat massivga adapter qo'shiladi.

Huquqiy jihatdan toza yagona rasmiy manba: **portal.kfb.or.kr** (은행연합회
소비자포털) — banklar komissiya va kurslarini u yerda rasman e'lon qiladi.
Faqat banklarni qoplaydi, 소액송금업체 larni emas. `QuoteSource.OFFICIAL`.

## Ish oqimi (Faza 0)

```
otkazma-olchov.xlsx to'ldiriladi
        ↓
npx ts-node tools/import-xlsx.ts ./otkazma-olchov.xlsx --dry   # tekshirish
npx ts-node tools/import-xlsx.ts ./otkazma-olchov.xlsx          # yuklash
        ↓
GET /rates/compare  →  Telegram kunlik post (08:00 Seul)
```

CLI birlik xatolarini tutadi: kurs 4–20 oralig'idan chiqsa qatorni rad etadi
(masalan so'm o'rniga ming so'm yozilgan bo'lsa).

---

## Asosiy dizayn qarorlari

**Domen Prisma'dan mustaqil.** Repozitoriy portlari (`PROVIDER_REPO`, `QUOTE_REPO`,
`TRANSFER_REPO`, …) orqali. Shu sababli mantiq DB'siz test qilinadi va Prisma
adapter sifatida almashtiriladi.

**`Quote` append-only.** `QuoteRepository` da `update` metodi ataylab yo'q.
Joriy kurs = `DISTINCT ON (providerId) ... ORDER BY fetchedAt DESC`.

**Pul — BigInt minor unit.** `Money` tipi valyutani ham olib yuradi;
turli valyutalarni qo'shish runtime'da xato beradi (testda tasdiqlangan).

**Ranking faqat qo'lga tekkan summa bo'yicha.** `Provider.affiliateActive`
maydoni bor, lekin `buildComparison()` da ishlatilmaydi — bunga alohida test
yozilgan (`affiliate provayderni yuqoriga ko'tarmaydi`).

**Eskirgan kotirovka yashirilmaydi.** 6 soatdan eski bo'lsa `isStale` va
`staleHours` bilan qaytadi; UI'da "9 soat oldin" deb ko'rsatiladi.

**Moslashtirish deterministik.** Bir nechta nomzod yoki past parser ishonchi →
`ASK_USER`. Avtomatik bog'lash faqat bitta kuchli nomzod bo'lganda.
Har bir tasdiqlangan moslik `QuoteSource.OBSERVED` bo'lib yoziladi — bu
reklama qilingan emas, **real qo'lga tekkan** kurs, va scraping bilan
takrorlanmaydi.

**Roziliksiz hech narsa qabul qilinmaydi.** `MatchingService.ingest()` avval
`ConsentRepository.hasSmsConsent()` ni tekshiradi, aks holda 403.

**Raw SMS serverga chiqmaydi.** Kotlin receiver xom matnni faqat Dart tomoniga
uzatadi; parsing qurilmada; API'ga `{amount, kind, bank, occurredAt, confidence}`
ketadi.

---

## Sen bajarishing kerak bo'lgan ishlar

1. **Kurslarni o'lchash** — `otkazma-olchov.xlsx`. Buni men qila olmayman.
   Natija 1% dan kichik bo'lsa `rates` modulini butunlay o'chir va faqat
   `household` bilan davom et.
2. **`prisma generate` + `migrate`** — bu muhitda Prisma engine binarilari
   bloklangan edi (`binaries.prisma.sh` 403), shuning uchun migratsiya
   yaratilmagan. Sening mashinangda bir buyruq.
3. **Real SMS matnlari** — `src/parsers/parsers.seed.json` dagi shablonlar
   **taxmin**, tekshirilmagan. Kapital/Humo SMS'larini olgach qayta yoz:
   versiyani oshir, eskisini `isActive` qoldir (fallback sifatida ishlaydi,
   ishonch pasayadi va foydalanuvchidan tasdiq so'raladi).
4. **`flutter create .`** — platforma papkalarini generatsiya qiladi.
   `android/app/src/main/` dagi tayyor `AndroidManifest.xml`, `MainActivity.kt`
   va `SmsReceiver.kt` fayllarini generatsiyadan keyin qaytarib qo'y
   (Flutter ularni o'z shablonlari bilan almashtiradi).

5. **Eski `flutter create` eslatmasi** — `mobile/` da faqat `lib/`, `pubspec.yaml` va
   receiver bor; platforma papkalarini Flutter o'zi generatsiya qiladi.
   `AndroidManifest.xml` ga `RECEIVE_SMS` va receiver'ni qo'lda qo'shish kerak.
6. **Play Store deklaratsiyasi** — Manifest'da ataylab faqat `RECEIVE_SMS`
   so'raladi, `READ_SMS` emas: bizga eski xabarlar kerak emas va kamroq ruxsat
   tekshiruvni osonlashtiradi. Formada asos sifatida moliyaviy tranzaksiya
   kuzatuvini yozish va demo video berish kerak.
7. **Telegram bot tokeni** — `.env` da `TELEGRAM_BOT_TOKEN` va
   `TELEGRAM_CHANNEL_ID`.

## Integratsiya testi nimani isbotlaydi

`src/matching/flow.integration.spec.ts` — Postgres'siz, lekin **aynan o'sha portlar**
implementatsiyasi bilan:

1. Jadvaldan import → `Quote` yoziladi
2. Taqqoslashda affiliate'li provayder yuqoriga chiqmaydi
3. 500 000 KRW yuborilsa prognoz proporsional hisoblanadi (4 270 000 so'm)
4. 0.5% farq bilan kelgan SMS avtomatik bog'lanadi
5. `OBSERVED` kurs yoziladi va keyingi taqqoslashda **ishlatiladi**
6. Ikkita o'xshash SMS kelsa — bog'lanmaydi, `ASK_USER`
7. Rozilik yo'q bo'lsa — 403 va hodisa **saqlanmaydi**
8. Boshqa oilaning hodisasini bog'lash mumkin emas
9. Birlik xatosi (so'm o'rniga ming so'm) importda tutiladi

## Hal qilinmagan strategik savol

Agar Toss chindan mid-market kurs bersa, taqqoslash javobi doim "Toss" bo'ladi
va `rates` moduli keraksiz. Bu yomon natija emas — byudjet qismi baribir
kuchliroq g'oya edi, chunki taqqoslash bir martalik qidiruv, byudjet esa har
oyda takrorlanadi. Birinchi o'lchov shuni hal qiladi.
