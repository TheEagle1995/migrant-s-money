#!/usr/bin/env bash
# `flutter create` platforma fayllarini o'z shablonlari bilan qayta yozadi.
# Bu skript bizning fayllarni ustiga qaytaradi. CI va lokal build'da bir xil ishlaydi.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d android ]; then
  echo "android/ yo'q — avval ishga tushiring:"
  echo "  flutter create --platforms=android --org uz.remit ."
  exit 1
fi

cp -v android_overrides/app/src/main/AndroidManifest.xml \
      android/app/src/main/AndroidManifest.xml

mkdir -p android/app/src/main/kotlin/uz/remit
cp -v android_overrides/app/src/main/kotlin/uz/remit/*.kt \
      android/app/src/main/kotlin/uz/remit/

# flutter create boshqa paket nomida MainActivity yaratgan bo'lsa — olib tashlaymiz
find android/app/src/main/kotlin -name MainActivity.kt ! -path "*uz/remit/*" -delete 2>/dev/null || true

echo "Android overrides qo'llandi."
