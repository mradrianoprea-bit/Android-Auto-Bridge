# AutoBridge AA (v1.1.0)

Aplicație Android Kotlin care detectează conectarea telefonului Android la **Android Auto** (`CarConnection.CONNECTION_TYPE_PROJECTION`), se conectează prin **Apple ANCS (BLE GATT)** la iPhone-ul asociat și transferă automat apelurile primite pe **+40 722 450 890** direct pe ecranul și sistemul audio al mașinii (Android Auto).

## Cum funcționează (fără root, fără jailbreak, fără Shortcuts blocate de iOS)

1. **Detectare apel în timp real pe iPhone (Apple ANCS):** telefonul Android se conectează nativ la serviciul Apple ANCS (`7905F431-B5CE-4E99-A40F-4B1E122D00D0`) al iPhone-ului asociat Bluetooth și măsoară proximitatea RSSI (`-72 dBm`).
2. **Transfer instant pe Android Auto:** doar atunci când telefonul Android este conectat la Android Auto și iPhone-ul este în habitaclu, la sosirea unui apel pe iPhone, Android trimite automat comanda ANCS *Decline (Ocupat)*.
3. **Voce 100% nativă pe sistemul mașinii:** deoarece pe iPhone este activată o singură dată redirecționarea la ocupat (`*67*+40744112300#`), operatorul mobil transferă instant apelul (cu numărul apelantului și voce HD) pe telefonul Android conectat la Android Auto!
4. **Când ieși din mașină (Android Auto deconectat):** aplicația Android nu mai trimite comanda ANCS, deci apelurile sună din nou normal pe iPhone.

## Configurare pe iPhone (o singură dată, 1 minut)

1. Asociază prin **Bluetooth** iPhone-ul cu telefonul Android, apoi intră pe iPhone în **Setări → Bluetooth → (i) lângă telefonul Android** și activează **Partajare notificări sistem (Share System Notifications)**.
2. Deschide aplicația **AutoBridge AA** pe Android și selectează iPhone-ul din lista de dispozitive Bluetooth asociate.
3. Pe iPhone, din aplicația **Telefon** (tastatură), apelează o singură dată codul GSM:
   `*67*+40744112300#`
   *(Pentru a dezactiva oricând redirecționarea la ocupat, apelează `#67#`.)*

## Compilare și semnare APK (Local)

```bash
chmod +x build-signed-apk.sh
./build-signed-apk.sh
```

APK-ul final semnat (V1/V2/V3/V4) este generat în `dist/AutoBridgeAA-v1.1.0-signed.apk`.
