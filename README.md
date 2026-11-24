Transfer apeluri de la Iphone catre android la conectarea la Android auto.

## Structura repository-ului

- `android/` — Proiectul complet Android Kotlin + Jetpack Compose + Android Auto (`CarConnection`, `AppleProximityScanner`, `CallBridgeForegroundService`, `BridgeConnectionService`, `AutoBridgeCarAppService`) și scriptul de compilare/semnare `android/build-signed-apk.sh`.
- `.github/workflows/build-signed-apk.yml` — Pipeline GitHub Actions care compilează, aliniază (`zipalign`), semnează (`apksigner` V1–V4 cu cheie RSA-4096) și publică automat fișierul `.apk` semnat în fila **Actions → Artifacts**.
- `src/` — Interfața web **AutoBridge AA** (configurator număr Apple / prag RSSI / parametri semnare, simulator Android Auto și export `.zip` personalizat).

## Obținerea APK-ului compilat și semnat pe GitHub

1. După **Push to GitHub**, deschide fila **Actions** din repository.
2. Workflow-ul **Compile & Sign AutoBridge AA APK** pornește automat (sau poate fi rulat manual cu **Run workflow**).
3. Descarcă fișierul `AutoBridgeAA-v1.0.0-signed-apk` din secțiunea **Artifacts** (opțional poți seta secretul `KEYSTORE_PASSWORD` în *Settings → Secrets and variables → Actions*).

## Compilare locală APK (opțional)

```bash
cd android
chmod +x build-signed-apk.sh
./build-signed-apk.sh
```

APK-ul final semnat este generat în `android/dist/AutoBridgeAA-v1.0.0-signed.apk`.
