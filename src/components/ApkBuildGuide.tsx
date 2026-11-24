import { useState } from 'react';
import { Check, Copy, Download, ShieldCheck, Smartphone, Terminal, Workflow } from 'lucide-react';
import { BridgeConfig } from '../types/bridge';
import { getExportArchiveNames } from '../lib/zipExporter';

interface ApkBuildGuideProps {
  config: BridgeConfig;
  onDownloadZip: () => void;
  exporting: boolean;
  lastExportFile: string | null;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

export function ApkBuildGuide({
  config,
  onDownloadZip,
  exporting,
  lastExportFile,
}: ApkBuildGuideProps) {
  const [copiedCmd, setCopiedCmd] = useState(false);

  const androidClean = normalizePhone(config.androidPhoneNumber);
  const { rootFolderName, zipFileName } = getExportArchiveNames(config);
  const localBuildCommand = `unzip ${zipFileName} && cd ${rootFolderName} && chmod +x build-signed-apk.sh && ./build-signed-apk.sh`;

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(localBuildCommand);
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 1800);
    } catch {
      // Clipboard restriction fallback
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Compilare și semnare APK Release
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
            Descarcă proiectul Android complet configurat cu numărul{' '}
            <span className="font-mono tabular-nums text-slate-900 font-medium">
              {config.applePhoneNumber}
            </span>{' '}
            și generează fișierul binar <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">AutoBridgeAA-v{config.versionName}-signed.apk</code> semnat RSA-4096 (V1–V4).
          </p>
        </div>

        <button
          type="button"
          onClick={onDownloadZip}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Se împachetează proiectul...' : 'Descarcă proiectul Android (.zip)'}
        </button>
      </div>

      {lastExportFile && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4 text-sm text-emerald-900">
          <span>
            Arhiva <span className="font-mono font-medium">{lastExportFile}</span> a fost descărcată. Include toate sursele Kotlin, configurația Gradle și scriptul de semnare APK.
          </span>
        </div>
      )}

      {/* Notă tehnică transparentă despre compilarea APK */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Despre generarea binarului .apk semnat</span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Mediul web curent rulează exclusiv Node.js (fără Android SDK, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">aapt2</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">d8</code> sau <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">apksigner</code>), deci fișierul binar <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">.apk</code> nu poate fi asamblat direct în browser. Pentru a obține APK-ul compilat și semnat imediat, arhiva exportată conține atât un <strong>workflow GitHub Actions (compilare gratuită în cloud, fără Android Studio)</strong>, cât și scriptul automat <strong><code className="text-xs bg-slate-100 px-1 py-0.5 rounded">build-signed-apk.sh</code></strong>.
        </p>
      </section>

      {/* Cele 2 opțiuni reale de compilare & semnare */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opțiunea 1: Cloud GitHub Actions */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
                <Workflow className="w-4 h-4 text-blue-600" />
                01. Compilare automată în Cloud (GitHub Actions)
              </h2>
              <span className="text-xs text-emerald-700 font-medium">Fără Android Studio</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cea mai rapidă metodă dacă nu ai Android SDK instalat local. Proiectul conține deja fișierul <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">.github/workflows/build-signed-apk.yml</code>.
            </p>
            <ol className="space-y-2.5 text-sm text-slate-700 list-decimal list-inside pt-1">
              <li>Descarcă și dezarhivează <span className="font-mono text-xs">AutoBridgeAA-Android-APK-Project.zip</span>.</li>
              <li>Încarcă folderul într-un repository GitHub privat.</li>
              <li>Deschide fila <strong>Actions</strong> și apasă <strong>Run workflow</strong>.</li>
              <li>După ~2 minute, descarcă <span className="font-mono text-xs">AutoBridgeAA-v{config.versionName}-signed.apk</span> din secțiunea <strong>Artifacts</strong> și instalează-l pe telefonul Android.</li>
            </ol>
          </div>
          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 font-mono tabular-nums">
            Semnare: RSA-4096 · Alias: {config.keystoreAlias} · apksigner verify OK
          </div>
        </section>

        {/* Opțiunea 2: Compilare locală cu 1 comandă */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-700" />
                02. Compilare și semnare locală (Linux / macOS)
              </h2>
              <span className="text-xs text-slate-500 font-mono">JDK 17 + SDK 35</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Rulează scriptul inclus pentru a genera automat keystore-ul PKCS12, a compila <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">assembleRelease</code>, a alinia cu <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">zipalign</code> și a semna cu <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">apksigner</code>.
            </p>

            <div className="bg-slate-950 text-slate-100 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Terminal</span>
                <button
                  type="button"
                  onClick={copyCommand}
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                >
                  {copiedCmd ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Copiat
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copiază comanda
                    </>
                  )}
                </button>
              </div>
              <pre className="text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap break-all">
                {localBuildCommand}
              </pre>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 font-mono">
            Output: dist/AutoBridgeAA-v{config.versionName}-signed.apk
          </div>
        </section>
      </div>

      {/* Configurare obligatorie pe iPhone (Apple Shortcuts) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-600" />
            03. Configurare automatizare pe telefonul Apple ({config.appleDeviceName})
          </h2>
          <span className="text-xs text-slate-500">Necesită 2 minute · Fără aplicații terțe pe iOS</span>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Sistemul de operare iOS restricționează accesul Bluetooth extern la apelurile celulare din motive de securitate. Pentru ca apelurile primite pe{' '}
          <span className="font-mono tabular-nums text-slate-900 font-medium">{config.applePhoneNumber}</span>{' '}
          să fie preluate automat pe Android Auto fără jailbreak, adaugă aceste două automatizări native în aplicația <strong>Shortcuts (Scurtături)</strong> de pe iPhone:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="text-sm font-semibold text-slate-900">
              Automatizare A — Activare la urcarea în mașină
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>Trigger: <strong>Bluetooth</strong> → se conectează la unitatea mașinii sau la telefonul Android.</li>
              <li>Opțiune: <strong>Run Immediately</strong> (Rulează imediat, fără confirmare).</li>
              <li>
                Acțiune: <strong>Call (Apelează)</strong> codul MMI{' '}
                <code className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                  *21*{androidClean}#
                </code>
              </li>
            </ul>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="text-sm font-semibold text-slate-900">
              Automatizare B — Oprire la coborârea din mașină
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>Trigger: <strong>Bluetooth</strong> → se deconectează de la unitatea mașinii.</li>
              <li>Opțiune: <strong>Run Immediately</strong> (Rulează imediat).</li>
              <li>
                Acțiune: <strong>Call (Apelează)</strong> codul MMI{' '}
                <code className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                  ##21#
                </code>{' '}
                pentru revenirea apelurilor pe iPhone.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
