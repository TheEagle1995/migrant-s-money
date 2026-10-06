# Audit — ko'p davlatga o'tishdan oldin

Koridor qo'shish talabi kodda yashirin turgan oltita farazni ochib berdi.
Hammasi tuzatildi; har biri uchun test yozildi, shuning uchun qaytib kelmaydi.

---

## 1. Valyuta kasri barcha joyda nol deb olingan — **ma'lumot buzilishi**

```ts
// ilgari: src/parsers/sms-parser.ts
return BigInt(Math.round(n));
```

KRW kasrsiz, amalda UZS ham shunday ishlatiladi — shuning uchun bu xato
Koreya koridorida ko'rinmaydi. Rossiyani qo'shgan zahoti buziladi:

| Kelgan SMS | Ilgari saqlangan | To'g'ri |
|---|---|---|
| `50 000,50 ₽` | 50 001 RUB | 50 000 RUB 50 kopeyka |

Byudjet ilovasida bu eng yomon turdagi xato: foydalanuvchi sezmaydi, lekin
hisob har bir o'tkazmada asta-sekin chalkashadi.

**Tuzatish.** `src/domain/currency.ts` — har bir valyuta ISO 4217 kasri bilan
saqlanadi va barcha arifmetika shu orqali o'tadi. `parseMinor` float orqali
umuman o'tmaydi: butun va kasr qismlar satr sifatida ishlanadi, shuning uchun
katta summalarda aniqlik yo'qolmaydi.

UZS rasmiy ravishda ikki kasrli (tiyin). Tiyin muomalada yo'q, lekin o'zbek
banklari SMS'da `1 250 000,00` shaklida yuboradi — shuning uchun ikki raqam
bilan ishlash parsing uchun ham to'g'riroq.

**Testlar:** `src/domain/currency.spec.ts` (23 ta), shu jumladan
`parse → format → parse` aylanmasi har bir valyuta uchun.

---

## 2. Import tekshiruvi bitta koridorga moslangan edi — **har bir to'g'ri qator rad etilardi**

```ts
// ilgari: src/rates/manual-import.service.ts
if (rate < 4 || rate > 20) return 'kurs shubhali';
```

Bu oraliq faqat KRW→UZS uchun to'g'ri. RUB→UZS kursi ~150, ya'ni Rossiya
koridorining **har bir haqiqiy qatori** "shubhali" deb rad etilardi.

**Tuzatish.** Oraliq `Corridor.sanityRateMin/Max` dan keladi. Har bir koridor
o'z to'sig'ini olib yuradi, va bu to'siq narx emas — faqat birlik xatosini
tutish uchun ataylab keng.

---

## 3. Ogohlantirish chegarasi ham qattiq yozilgan edi

```ts
// ilgari: src/bot/alerts.service.ts
if (thresholdMinor < 4_000_000n || thresholdMinor > 20_000_000n)
```

Xuddi shu muammo. Endi `thresholdBounds(corridorId)` koridorning bazasi va
sanity kursidan hisoblaydi, ya'ni yangi koridor qo'shilganda avtomatik
to'g'ri bo'ladi.

---

## 4. Taqqoslash bazasi `1 000 000 KRW` deb qotib qolgan edi

```ts
export const BASE_SEND_KRW = 1_000_000n;
```

Rossiya uchun ma'nosiz raqam — u yerda odamlar 50 000 rubl yuboradi.
Normalizatsiya bazasi bo'lmasa, taqqoslash adolatsiz chiqadi.

**Tuzatish.** `Corridor.baseSendMinor`. Har bir koridor o'z standart summasiga
ega va u sarlavhada ko'rsatiladi, shuning uchun foydalanuvchi nimaga nisbatan
taqqoslanayotganini biladi.

---

## 5. Banklar ro'yxati **uchta** joyda qattiq yozilgan edi

| Fayl | Nima |
|---|---|
| `src/parsers/sms-parser.ts` | `SENDER_MAP` |
| `mobile/lib/.../sms_pipeline.dart` | `_senderMap` |
| `mobile/.../SmsReceiver.kt` | `KNOWN` |

Rossiya bankini qo'shish uchun uchta faylni tahrirlab, ilovani qaytadan
Play Store'ga chiqarish kerak bo'lardi. Kotlin ro'yxati esa eng xavfli joyda
turgan: u qaysi SMS umuman Dart tomoniga o'tishini belgilaydi, ya'ni ro'yxatda
yo'q bankning xabari hech qachon ko'rinmaydi.

**Tuzatish.** `Bank` modeli + `banks.seed.json` → serverdan keladi.
`SmsParser.allowedSenders()` Kotlin tomoniga uzatiladigan ro'yxatni beradi.
Hozir 24 bank, 6 davlat.

---

## 6. Provayderlarda davlat yo'q edi

`Provider` da `sendCountries` bo'lmaganidan Sentbe (Koreya) va Korona Pay
(Rossiya) bitta ro'yxatda chiqib qolardi.

**Tuzatish.** `Provider.sendCountries` + `Quote.corridorId`, va taqqoslash
faqat o'z koridorining kotirovkalarini oladi. Bunga alohida test bor:
*"boshqa koridorning kotirovkasini qo'shmaydi"*.

---

## Refaktor paytida topilgan qo'shimcha xato

`normalizeSender` lotin bo'lmagan harflarni o'chirardi, va men uni SMS turini
aniqlashda ham ishlatib yuborgan edim. Natijada `зачисление` bo'sh satrga
aylanib, **barcha rus bank xabarlari** o'qilmas edi. To'rtta test bu xatoni
darhol ushladi.

---

## Hali ochiq

- **Parser shablonlari taxmin.** Rus va qozoq shablonlari faqat tipik
  formatga asoslangan. Real SMS matnlari kelgach versiyani oshirib qayta
  yozish kerak — eskisi fallback bo'lib qoladi va ishonch pasayadi.
- **Koridor sanity oraliqlari keng.** Birinchi o'lchovlardan keyin toraytirish
  mumkin, lekin shoshilmaslik kerak: tor oraliq to'g'ri qatorni rad etadi.
- **Faqat `UZ` qabul qiluvchi davlat sifatida sinalgan.** `RU→KG` va `RU→TJ`
  koridorlari registrda bor, lekin `isLive: false` — provayder va bank
  ma'lumoti yig'ilmagan.
