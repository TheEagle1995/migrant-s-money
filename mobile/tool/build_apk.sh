#!/usr/bin/env bash
# Lokal APK qurish. Flutter SDK o'rnatilgan bo'lishi kerak.
#   ./tool/build_apk.sh [API_URL]
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="${1:-}"

if [ ! -d android ]; then
  echo "==> Platforma fayllari yaratilmoqda"
  flutter create --platforms=android --org uz.remit --project-name remit .
fi

echo "==> Android overrides"
./tool/apply_android_overrides.sh

echo "==> pub get"
flutter pub get

echo "==> APK"
if [ -n "$API_URL" ]; then
  flutter build apk --release --dart-define=API_URL="$API_URL"
else
  flutter build apk --release
fi

echo
echo "Tayyor: build/app/outputs/flutter-apk/app-release.apk"
ls -lh build/app/outputs/flutter-apk/app-release.apk
