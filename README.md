Transfer apeluri de la Iphone catre android la conectarea la Android auto.

## Cum funcționează AutoBridge AA v1.1.0 (Apple ANCS + Redirecționare la ocupat `*67*`)

1. Telefonul Android detectează automat conectarea la **Android Auto** (`CarConnection` + `CarConnectionReceiver`) și se conectează prin **Apple ANCS (BLE GATT)** la iPhone-ul asociat Bluetooth.
2. Când primești un apel pe iPhone și ești conectat la Android Auto (cu iPhone-ul în habitaclu), aplicația Android primește instant evenimentul ANCS `IncomingCall` și trimite comanda ANCS **Decline (Ocupat)** către iPhone.
3. Deoarece pe iPhone este activată o singură dată redirecționarea GSM la ocupat (`*67*<NumărAndroid>#`), operatorul transferă apelul instant (cu voce HD și numărul apelantului) pe telefonul Android, unde sună nativ pe **Android Auto**.
4. Când ieși din mașină (Android Auto deconectat), aplicația Android nu mai trimite comanda ANCS, iar apelurile sună din nou normal pe iPhone.

## Configurare pe iPhone (o singură dată)

1. Asociază prin **Bluetooth** iPhone-ul cu telefonul Android, apoi intră pe iPhone în **Setări → Bluetooth → (i) lângă telefonul Android** și activează **Partajare notificări sistem (Share System Notifications)**.
2. Deschide **AutoBridge AA** pe Android și selectează iPhone-ul din lista dispozitivelor Bluetooth asociate (verifică în panoul de diagnostic `iPhone ANCS: READY`).
3. Pe iPhone, din aplicația **Telefon** (tastatură), apelează o singură dată `*67*<NumărAndroid>#` (pentru anulare oricând: `#67#`).

## Compilare și descărcare APK semnat (GitHub Actions)

1. După **Push to GitHub**, deschide fila **Actions** → **Compile & Sign AutoBridge AA APK**.
2. Descarcă `AutoBridgeAA-v1.1.0-signed-apk` din **Artifacts** și instalează-l pe telefonul Android.
