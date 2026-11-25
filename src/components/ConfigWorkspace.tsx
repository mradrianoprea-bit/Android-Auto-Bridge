import { RotateCcw, ArrowRight } from 'lucide-react';
import { BridgeConfig, BridgeMode, DEFAULT_BRIDGE_CONFIG, WorkspaceTab } from '../types/bridge';

interface ConfigWorkspaceProps {
  config: BridgeConfig;
  onChange: (next: BridgeConfig) => void;
  onNavigate: (tab: WorkspaceTab) => void;
}

function estimateMetersFromRssi(rssi: number): string {
  // Model log-distance estimativ în habitaclu auto (TxPower ≈ -56 dBm, n = 2.4)
  const meters = Math.pow(10, (-56 - rssi) / (10 * 2.4));
  return Math.max(0.3, Math.min(18, meters)).toFixed(1);
}

export function ConfigWorkspace({
  config,
  onChange,
  onNavigate,
}: ConfigWorkspaceProps) {
  const update = <K extends keyof BridgeConfig>(key: K, value: BridgeConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const handleModeChange = (mode: BridgeMode) => {
    update('bridgeMode', mode);
  };

  const isPhoneValid = config.applePhoneNumber.replace(/[^\d+]/g, '').length >= 9;
  const isAndroidPhoneValid = config.androidPhoneNumber.replace(/[^\d+]/g, '').length >= 9;

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Configurare preluare apeluri iPhone pe Android Auto
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
            Setează numărul telefonului Apple monitorizat, pragul de proximitate Bluetooth LE și parametrii de semnare APK. Toate modificările sunt injectate automat în codul Kotlin și în scripturile Gradle.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_BRIDGE_CONFIG)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Resetează valorile
        </button>
      </div>

      {/* Secțiunea 1: Identificare numere & dispozitiv Apple */}
      <section aria-labelledby="section-devices" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-1.5">
          <h2 id="section-devices" className="text-base font-semibold text-slate-900">
            01. Dispozitive și numere de telefon
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            La detectarea conexiunii Android Auto, serviciul caută dispozitivul Apple în habitaclu și activează preluarea apelurilor asociate numărului configurat.
          </p>
        </div>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="apple-phone" className="block text-sm font-medium text-slate-800">
                Număr telefon Apple (iPhone sursă)
              </label>
              <input
                id="apple-phone"
                type="tel"
                value={config.applePhoneNumber}
                onChange={(e) => update('applePhoneNumber', e.target.value)}
                placeholder="+40 722 450 890"
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              {!isPhoneValid ? (
                <p className="text-xs text-red-600">
                  Introdu un număr valid cu cel puțin 9 cifre (recomandat format +40...).
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Apelurile către acest număr vor fi preluate pe ecranul mașinii.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="android-phone" className="block text-sm font-medium text-slate-800">
                Număr telefon Android (conectat la mașină)
              </label>
              <input
                id="android-phone"
                type="tel"
                value={config.androidPhoneNumber}
                onChange={(e) => update('androidPhoneNumber', e.target.value)}
                placeholder="+40 744 112 300"
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              {!isAndroidPhoneValid ? (
                <p className="text-xs text-red-600">
                  Introdu numărul cartelei SIM din telefonul conectat la Android Auto.
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Folosit ca destinație pentru redirecționarea automată (*21*).
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="apple-device-name" className="block text-sm font-medium text-slate-800">
              Nume Bluetooth al telefonului Apple
            </label>
            <input
              id="apple-device-name"
              type="text"
              value={config.appleDeviceName}
              onChange={(e) => update('appleDeviceName', e.target.value)}
              placeholder="iPhone 15 Pro"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
            <p className="text-xs text-slate-500">
              Scannerul BLE filtrează pachetele Apple Continuity (Company ID 0x004C) și acest nume de dispozitiv.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="rssi-threshold" className="text-sm font-medium text-slate-800">
                Prag proximitate Bluetooth LE (RSSI)
              </label>
              <span className="text-sm font-mono tabular-nums font-medium text-slate-900">
                {config.rssiThresholdDbm} dBm · ~{estimateMetersFromRssi(config.rssiThresholdDbm)} m
              </span>
            </div>
            <input
              id="rssi-threshold"
              type="range"
              min={-86}
              max={-55}
              step={1}
              value={config.rssiThresholdDbm}
              onChange={(e) => update('rssiThresholdDbm', Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
              <span>-86 dBm (până la ~10 m)</span>
              <span>-72 dBm (habitaclu ~2.5 m)</span>
              <span>-55 dBm (lângă consolă ~0.9 m)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Secțiunea 2: Arhitectura punții și reguli de comportament */}
      <section aria-labelledby="section-bridge" className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-slate-200">
        <div className="lg:col-span-4 space-y-1.5">
          <h2 id="section-bridge" className="text-base font-semibold text-slate-900">
            02. Modul de preluare și reguli
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Alege mecanismul de transfer între iOS și Android Auto. Modul recomandat funcționează pe orice telefon fără root, combinând semnalul BLE cu o automatizare nativă Apple Shortcuts.
          </p>
        </div>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="space-y-2.5">
            <span className="block text-sm font-medium text-slate-800">
              Mecanism de preluare apeluri
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleModeChange('ancs_busy_forward')}
                className={`p-4 text-left rounded-lg border transition-colors ${
                  config.bridgeMode === 'ancs_busy_forward'
                    ? 'border-blue-600 bg-blue-50/50 text-slate-900'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">
                  Apple ANCS + Redirecționare la ocupat (*67*)
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Recomandat (voce HD nativă pe Android Auto, fără root/Shortcuts). La apel pe iPhone, Android trimite ANCS Ocupat, iar operatorul transferă apelul instant pe Android Auto.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('ancs_signal_only')}
                className={`p-4 text-left rounded-lg border transition-colors ${
                  config.bridgeMode === 'ancs_signal_only'
                    ? 'border-blue-600 bg-blue-50/50 text-slate-900'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">
                  Apple ANCS + Telecom ConnectionService
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Afișează apelul iPhone pe Android Auto cu butoane Răspunde/Respinge trimise spre iPhone prin ANCS (fără redirecționare operator *67*).
                </p>
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-100">
            <label className="flex items-start justify-between gap-4 py-4 cursor-pointer">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Verificare strictă a numărului Apple configurat
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Preia pe Android Auto exclusiv apelurile asociate numărului {config.applePhoneNumber}.
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.strictAppleNumberMatch}
                onChange={(e) => update('strictAppleNumberMatch', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
            </label>

            <label className="flex items-start justify-between gap-4 py-4 cursor-pointer">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Dezactivare automată la deconectarea Android Auto
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Oprește serviciul GATT și revine la recepția normală pe iPhone când oprești mașina.
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.autoRevertOnDisconnect}
                onChange={(e) => update('autoRevertOnDisconnect', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
            </label>

            <div className="py-4 space-y-3">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Răspuns automat pe Android Auto (hands-free)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Răspunde automat la apelurile preluate de pe iPhone după întârzierea aleasă.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.autoAnswerEnabled}
                  onChange={(e) => update('autoAnswerEnabled', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
              </label>

              {config.autoAnswerEnabled && (
                <div className="flex items-center gap-4 pt-1">
                  <span className="text-xs text-slate-600 whitespace-nowrap">
                    Întârziere preluare:
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={config.autoAnswerDelaySec}
                    onChange={(e) => update('autoAnswerDelaySec', Number(e.target.value))}
                    className="flex-1 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono tabular-nums font-medium text-slate-900 w-10 text-right">
                    {config.autoAnswerDelaySec} s
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Secțiunea 3: Identitate APK & Semnare Release */}
      <section aria-labelledby="section-signing" className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-slate-200">
        <div className="lg:col-span-4 space-y-1.5">
          <h2 id="section-signing" className="text-base font-semibold text-slate-900">
            03. Parametri APK și semnare Release
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Aceste valori configurează blocul <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">signingConfigs</code> din Gradle și certificatul RSA-4096 generat de scriptul de semnare.
          </p>
        </div>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="app-id" className="block text-sm font-medium text-slate-800">
                Application ID (pachet Android)
              </label>
              <input
                id="app-id"
                type="text"
                value={config.applicationId}
                onChange={(e) => update('applicationId', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="app-name" className="block text-sm font-medium text-slate-800">
                Nume aplicație instalată
              </label>
              <input
                id="app-name"
                type="text"
                value={config.appDisplayName}
                onChange={(e) => update('appDisplayName', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="version-name" className="block text-sm font-medium text-slate-800">
                Versiune APK (versionName)
              </label>
              <input
                id="version-name"
                type="text"
                value={config.versionName}
                onChange={(e) => update('versionName', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="keystore-alias" className="block text-sm font-medium text-slate-800">
                Alias cheie semnare (Keystore Alias)
              </label>
              <input
                id="keystore-alias"
                type="text"
                value={config.keystoreAlias}
                onChange={(e) => update('keystoreAlias', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Scheme semnare: V1 · V2 · V3 · V4 · RSA 4096-bit · minSdk 29 · targetSdk 35
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('simulator')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Testează în Simulator
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('build')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Continuă spre compilare APK
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
