#!/usr/bin/env bash
set -euo pipefail

APP_VERSION="1.0.0"
KEYSTORE_PATH="app/release-keystore.jks"
KEY_ALIAS="autobridge-release"
KEYSTORE_PASS="${KEYSTORE_PASSWORD:-AutoBridge2026!}"
ORG_NAME="AutoBridge Mobile"
OUT_DIR="dist"
FINAL_APK="${OUT_DIR}/AutoBridgeAA-v${APP_VERSION}-signed.apk"

mkdir -p "${OUT_DIR}"

# 1. Generează certificatul de semnare RSA-4096 dacă nu există
if [ ! -f "${KEYSTORE_PATH}" ]; then
  echo "[1/4] Generare keystore de semnare (${KEYSTORE_PATH})..."
  keytool -genkeypair -v \
    -keystore "${KEYSTORE_PATH}" \
    -storetype PKCS12 \
    -keyalg RSA \
    -keysize 4096 \
    -validity 10000 \
    -alias "${KEY_ALIAS}" \
    -storepass "${KEYSTORE_PASS}" \
    -keypass "${KEYSTORE_PASS}" \
    -dname "CN=${ORG_NAME}, OU=Mobile, O=${ORG_NAME}, L=Bucuresti, C=RO"
fi

# 2. Scrie keystore.properties pentru Gradle release signingConfig
cat > keystore.properties <<EOF
storeFile=release-keystore.jks
storePassword=${KEYSTORE_PASS}
keyAlias=${KEY_ALIAS}
keyPassword=${KEYSTORE_PASS}
EOF

# 3. Compilează APK-ul release (necesită JDK 17 + Android SDK 35)
echo "[2/4] Compilare Gradle assembleRelease..."
if [ -x "./gradlew" ]; then
  ./gradlew assembleRelease --no-daemon
else
  gradle assembleRelease --no-daemon
fi

UNSIGNED_OR_SIGNED="app/build/outputs/apk/release/app-release.apk"
if [ ! -f "${UNSIGNED_OR_SIGNED}" ]; then
  UNSIGNED_OR_SIGNED="app/build/outputs/apk/release/app-release-unsigned.apk"
fi

if [ ! -f "${UNSIGNED_OR_SIGNED}" ]; then
  echo "Eroare: nu a fost găsit APK-ul generat în app/build/outputs/apk/release/." >&2
  exit 1
fi

# 4. Aliniere și verificare / semnare apksigner (V1 + V2 + V3 + V4)
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
BUILD_TOOLS_DIR="$(ls -d "${SDK_ROOT}"/build-tools/* 2>/dev/null | sort -V | tail -n 1 || true)"

if [ -z "${BUILD_TOOLS_DIR}" ] || [ ! -x "${BUILD_TOOLS_DIR}/apksigner" ]; then
  echo "Eroare: Android build-tools (zipalign/apksigner) nu au fost găsite în ${SDK_ROOT}/build-tools." >&2
  exit 1
fi

echo "[3/4] Aliniere zipalign și semnare apksigner (${BUILD_TOOLS_DIR})..."
"${BUILD_TOOLS_DIR}/zipalign" -f -p 4 "${UNSIGNED_OR_SIGNED}" "${OUT_DIR}/aligned.apk"
"${BUILD_TOOLS_DIR}/apksigner" sign \
  --ks "${KEYSTORE_PATH}" \
  --ks-key-alias "${KEY_ALIAS}" \
  --ks-pass "pass:${KEYSTORE_PASS}" \
  --key-pass "pass:${KEYSTORE_PASS}" \
  --out "${FINAL_APK}" \
  "${OUT_DIR}/aligned.apk"

echo "[4/4] Verificare semnătură digitală APK..."
"${BUILD_TOOLS_DIR}/apksigner" verify --verbose --print-certs "${FINAL_APK}"
rm -f "${OUT_DIR}/aligned.apk"

echo "Succes! APK compilat și semnat disponibil la: ${FINAL_APK}"
