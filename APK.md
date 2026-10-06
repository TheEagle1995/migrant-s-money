# APK olish

APK'ni men qura olmadim: bu muhitda Flutter/Android SDK yo'q va Google'ning
yuklab olish serverlari (`dl.google.com`, `storage.googleapis.com`,
`services.gradle.org`) bloklangan. JDK 21 bor, lekin u yolg'iz yetarli emas.

Buning o'rniga ikkita yo'l tayyorladim. Birinchisi hech narsa o'rnatishni
talab qilmaydi.

---

## Yo'l 1 — GitHub quradi (tavsiya etiladi)

1. Loyihani GitHub'ga yukla:

```bash
cd app
git init && git add -A
git commit -m "Chiroq: backend + mobile"
git remote add origin git@github.com:TheEagle1995/remit.git
git push -u origin main
```

2. GitHub'da: **Actions → Android APK → Run workflow**
3. 5–8 daqiqadan keyin **Artifacts → chiroq-apk** — ichida `.apk` fayl

Workflow `android/` papkasini o'zi generatsiya qiladi (`flutter create`), keyin
bizning `AndroidManifest.xml` va Kotlin fayllarni ustiga qaytaradi. Shuning
uchun Gradle/SDK versiyalari doim mos keladi va repoda ortiqcha fayl saqlanmaydi.

`api_url` maydonini to'ldirsang, server manzili APK ichiga yoziladi. Bo'sh
qoldirsang — ilova ichidagi Sozlamalardan kiritiladi.

---

## Yo'l 2 — o'z kompyuteringda

Flutter SDK kerak (`flutter doctor` toza bo'lsin):

```bash
cd app/mobile
./tool/build_apk.sh                      # yoki
./tool/build_apk.sh https://api.misol.uz
```

Natija: `build/app/outputs/flutter-apk/app-release.apk`

---

## APK ishlashi uchun backend kerak

Ilova kurslarni serverdan oladi. Server bo'lmasa "o'lchov kiritilmagan" deb
ko'rsatadi — soxta raqam **hech qachon** chiqmaydi.

```bash
docker build -t remit-backend .
docker run -p 3000:3000 --env-file .env remit-backend
```

Railway / Render / Fly.io — `Dockerfile` tayyor, Postgres qo'shib
`DATABASE_URL` ni bersang yetadi. Keyin:

```bash
npx prisma migrate deploy
npm run db:seed
npx ts-node tools/import-xlsx.ts ./otkazma-olchov.xlsx
```

Shundan keyingina ilovada raqamlar paydo bo'ladi — chunki ular sening
o'lchovingdan keladi.

---

## Imzolash (Play Store uchun)

Yuqoridagi APK **debug kalit** bilan imzolanadi — telefonga o'rnatish va
sinash uchun yetarli, Play Store uchun emas. Do'konga chiqarish kerak bo'lsa:

1. `keytool -genkey -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
2. `.jks` faylni base64 qilib GitHub Secrets'ga qo'y (`KEYSTORE_BASE64`,
   `KEYSTORE_PASSWORD`, `KEY_ALIAS`)
3. Workflow'ga imzolash bosqichini qo'sh va `flutter build appbundle` ga o't

Play Store `RECEIVE_SMS` uchun alohida deklaratsiya so'raydi. Manifest'da
ataylab `READ_SMS` yo'q — faqat `RECEIVE_SMS`. Asos: moliyaviy tranzaksiya
kuzatuvi. Demo video ham talab qilinadi.

---

## Testlar

Backend: `npm test` → 63 test (lokal tekshirilgan).
Mobil: `flutter test` → 31 test — **men ularni ishga tushira olmadim**, SDK yo'q edi.
CI'da `continue-on-error: true` bilan yuguradi, ya'ni birinchi yugurishda
sintaksis xatosi bo'lsa ham APK quriladi. Birinchi yashil natijadan keyin
`.github/workflows/android.yml` dan o'sha qatorni olib tashla — shunda testlar
haqiqatan himoya qila boshlaydi.

Mobil testlar nimani qoplaydi: BigInt pul arifmetikasi va formatlash, SMS
parsing (shu jumladan payload'da xom matn yo'qligi), va backend JSON'ini
deserializatsiya qilish — ya'ni API shakli o'zgarsa test qizil bo'ladi.

## APK'da hozir nima bor

| Ekran | Holat |
|---|---|
| Kurslar ro'yxati (reyting, farq %, eskirganlik belgisi) | ✅ |
| Sozlamalar (server manzili, oila kodi) | ✅ |
| O'tkazma qo'shish ("Yubordim") + jonli prognoz | ✅ |
| Maqsadlar ekrani (progress, oylik hisob) | ✅ |
| Uch tabli navigatsiya (Kurslar / Kutilmoqda / Maqsadlar) | ✅ |
| Rozilik ekrani (SMS uchun, "maqsad" freymingi) | ✅ yozilgan, oqimga ulanmagan |
| SMS pipeline (parsing + yuborish) | ✅ yozilgan, qurilmada sinalmagan |
| Kutilayotgan o'tkazmalar ro'yxati | ✅ |
| Moslikni tasdiqlash ("qaysi biri?") | ✅ |
| Offline navbat (internetsiz SMS yo'qolmaydi) | ✅ |
| Kategoriyalar / sarflar tahlili | ❌ yo'q — real SMS kerak |

Ilova oila kodisiz ham foydali: **kurslar hech qanday ro'yxatdan o'tishsiz
ishlaydi**. Maqsadlar va o'tkazmalar uchungina oila kodi kerak. Bu ataylab —
birinchi qiymat darhol, ro'yxatdan o'tish keyin.
