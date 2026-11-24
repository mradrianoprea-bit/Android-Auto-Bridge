# AutoBridge AA (v1.0.0)

Aplicație Android Kotlin care detectează conectarea telefonului Android la **Android Auto** (`CarConnection.CONNECTION_TYPE_PROJECTION`), verifică proximitatea telefonului **Apple iPhone** (`iPhone 15 Pro — Adrian`, prag `-72 dBm`) prin Bluetooth LE și preia apelurile asociate numărului **+40 722 450 890** direct pe ecranul și sistemul audio al mașinii.

## Configurație inclusă la generare

- **Număr iPhone (sursă apeluri):** `+40 722 450 890`
- **Număr Android (Android Auto):** `+40 744 112 300`
- **Dispozitiv Apple monitorizat:** `iPhone 15 Pro — Adrian`
- **Prag proximitate BLE RSSI:** `-72 dBm`
- **ID pachet Android:** `ro.autobridge.applecall`
- **Alias certificat semnare:** `autobridge-release`

## 1. Compilare și semnare APK (Local, o singură comandă)

Cerințe: JDK 17, Gradle 8.10+ și Android SDK (API 35 + Build Tools).

```bash
chmod +x build-signed-apk.sh
./build-signed-apk.sh
```

APK-ul final semnat (V1/V2/V3/V4) și verificat cu `apksigner verify` va fi generat în:
`dist/AutoBridgeAA-v1.0.0-signed.apk`

## 2. Compilare automată în Cloud (fără Android Studio)

1. Creează un repository GitHub privat și încarcă **conținutul** acestui folder (astfel încât `.github/workflows/build-signed-apk.yml` să fie în rădăcina repository-ului).
2. Accesează fila **Actions** → **Compile & Sign AutoBridge AA APK** → **Run workflow**.
3. Descarcă fișierul `AutoBridgeAA-v1.0.0-signed.apk` din secțiunea **Artifacts**.

## 3. Configurare automatizare pe iPhone (Apple Shortcuts)

Deoarece iOS nu permite unui telefon Android extern să preia direct canalul celular fără consimțământul iPhone-ului, configurează pe iPhone două automatizări simple în aplicația **Shortcuts (Scurtături)**:

1. **La conectarea Bluetooth a mașinii / a telefonului Android** → Acțiunea **Call (Apelează)** `*21*+40744112300#` (activează redirecționarea apelurilor de pe `+40 722 450 890` către `+40 744 112 300`).
2. **La deconectarea Bluetooth a mașinii** → Acțiunea **Call (Apelează)** `##21#` (dezactivează redirecționarea automată).
