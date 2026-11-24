import { useEffect, useRef, useState } from 'react';
import {
  Bluetooth,
  Car,
  Mic,
  MicOff,
  Navigation,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Smartphone,
  Volume2,
} from 'lucide-react';
import { BridgeConfig, CallState, SimulatorLogEntry } from '../types/bridge';

interface AndroidAutoSimulatorProps {
  config: BridgeConfig;
}

function distanceToRssi(distanceMeters: number): number {
  const safeDist = Math.max(0.3, distanceMeters);
  return Math.round(-56 - 24 * Math.log10(safeDist));
}

function nowTimeString(): string {
  const d = new Date();
  return d.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function AndroidAutoSimulator({ config }: AndroidAutoSimulatorProps) {
  const [aaConnected, setAaConnected] = useState(true);
  const [iphoneDistance, setIphoneDistance] = useState(1.1);
  const [incomingCallerName, setIncomingCallerName] = useState('Andrei Ionescu');
  const [incomingCallerNumber, setIncomingCallerNumber] = useState('+40 731 804 210');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [muted, setMuted] = useState(false);
  const [autoAnswerCountdown, setAutoAnswerCountdown] = useState<number | null>(null);
  const [logs, setLogs] = useState<SimulatorLogEntry[]>([
    {
      id: 'init-1',
      timestamp: nowTimeString(),
      source: 'Android Auto',
      level: 'nominal',
      message: 'Proiecție Android Auto activă (CONNECTION_TYPE_PROJECTION).',
    },
    {
      id: 'init-2',
      timestamp: nowTimeString(),
      source: 'BLE Proximitate',
      level: 'nominal',
      message: `Dispozitiv "${config.appleDeviceName}" detectat în habitaclu (${distanceToRssi(1.1)} dBm).`,
    },
    {
      id: 'init-3',
      timestamp: nowTimeString(),
      source: 'Punte Apeluri',
      level: 'nominal',
      message: `Preluare apeluri armată pentru numărul Apple ${config.applePhoneNumber}.`,
    },
  ]);

  const currentRssi = distanceToRssi(iphoneDistance);
  const iphoneInRange = currentRssi >= config.rssiThresholdDbm;
  const bridgeActive = aaConnected && iphoneInRange;
  const prevBridgeActiveRef = useRef(bridgeActive);

  const appendLog = (
    source: SimulatorLogEntry['source'],
    level: SimulatorLogEntry['level'],
    message: string
  ) => {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: nowTimeString(),
        source,
        level,
        message,
      },
      ...prev.slice(0, 19),
    ]);
  };

  // Detect bridge state transitions
  useEffect(() => {
    if (prevBridgeActiveRef.current !== bridgeActive) {
      prevBridgeActiveRef.current = bridgeActive;
      if (bridgeActive) {
        appendLog(
          'Punte Apeluri',
          'nominal',
          `Punte activată: Android Auto conectat și ${config.appleDeviceName} în proximitate (${currentRssi} dBm ≥ ${config.rssiThresholdDbm} dBm).`
        );
      } else {
        const reason = !aaConnected
          ? 'Android Auto a fost deconectat'
          : `iPhone-ul a ieșit din raza setată (${currentRssi} dBm < ${config.rssiThresholdDbm} dBm)`;
        appendLog(
          'Punte Apeluri',
          'warning',
          `Punte dezactivată: ${reason}.${config.autoRevertOnDisconnect ? ' Redirecționarea iOS (##21#) oprită.' : ''}`
        );
        if (callState === 'ringing_aa') {
          setCallState('ringing_iphone_only');
        }
      }
    }
  }, [bridgeActive, aaConnected, currentRssi, config.appleDeviceName, config.rssiThresholdDbm, config.autoRevertOnDisconnect, callState]);

  // Active call timer
  useEffect(() => {
    if (callState !== 'active_aa') {
      setCallDurationSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setCallDurationSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callState]);

  // Auto-answer countdown when ringing on Android Auto
  useEffect(() => {
    if (callState !== 'ringing_aa' || !config.autoAnswerEnabled) {
      setAutoAnswerCountdown(null);
      return;
    }
    setAutoAnswerCountdown(config.autoAnswerDelaySec);
    const interval = window.setInterval(() => {
      setAutoAnswerCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          window.clearInterval(interval);
          setCallState('active_aa');
          appendLog(
            'Android Auto',
            'nominal',
            `Apel preluat automat pe difuzoarele mașinii după ${config.autoAnswerDelaySec} s.`
          );
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [callState, config.autoAnswerEnabled, config.autoAnswerDelaySec]);

  const handleToggleAndroidAuto = () => {
    const next = !aaConnected;
    setAaConnected(next);
    appendLog(
      'Android Auto',
      next ? 'nominal' : 'warning',
      next
        ? 'Telefonul Android s-a conectat la unitatea mașinii (CONNECTION_TYPE_PROJECTION).'
        : 'Conexiunea Android Auto a fost întreruptă (CONNECTION_TYPE_NOT_CONNECTED).'
    );
    if (!next && callState === 'active_aa') {
      setCallState('idle');
      setMuted(false);
    }
  };

  const handleSimulateIncomingCall = () => {
    setMuted(false);
    appendLog(
      'iPhone Apple',
      'nominal',
      `Apel primit pe ${config.applePhoneNumber} de la ${incomingCallerName} (${incomingCallerNumber}).`
    );

    if (bridgeActive) {
      setCallState('ringing_aa');
      appendLog(
        'Punte Apeluri',
        'nominal',
        `Apel interceptat și rutat pe ecranul Android Auto prin ${
          config.bridgeMode === 'ios_shortcut_forwarding'
            ? 'redirecționare automată iOS → Android'
            : 'BridgeConnectionService (HFP/Telecom)'
        }.`
      );
    } else {
      setCallState('ringing_iphone_only');
      const blocker = !aaConnected
        ? 'Android Auto nu este conectat'
        : `iPhone-ul se află la ${iphoneDistance.toFixed(1)} m (${currentRssi} dBm < pragul ${config.rssiThresholdDbm} dBm)`;
      appendLog(
        'Punte Apeluri',
        'alert',
        `Apelul NU a fost preluat pe mașină: ${blocker}. Sună doar pe iPhone.`
      );
    }
  };

  const handleAnswerOnAA = () => {
    setCallState('active_aa');
    setAutoAnswerCountdown(null);
    appendLog(
      'Android Auto',
      'nominal',
      `Apel preluat pe Android Auto (${incomingCallerName} via ${config.applePhoneNumber}). Audio rutat către Bluetooth/mașină.`
    );
  };

  const handleRejectOrEnd = () => {
    const wasActive = callState === 'active_aa';
    setCallState('idle');
    setMuted(false);
    setAutoAnswerCountdown(null);
    appendLog(
      'Android Auto',
      'warning',
      wasActive
        ? `Apel încheiat după ${formatCallDuration(callDurationSec)}.`
        : 'Apel respins.'
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Simulator Android Auto și proximitate iPhone
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
            Testează condițiile exacte ale aplicației: conectarea la Android Auto, distanța Bluetooth LE a telefonului Apple și preluarea apelurilor de pe{' '}
            <span className="font-mono tabular-nums text-slate-900 font-medium">
              {config.applePhoneNumber}
            </span>
            .
          </p>
        </div>

        <div className="text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap">
          Stare punte:{' '}
          <span className={bridgeActive ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
            {bridgeActive ? 'ACTIVĂ' : 'ÎN AȘTEPTARE'}
          </span>
        </div>
      </div>

      {/* Zona principală: Head-Unit Android Auto + Panou Control Hardware */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Ecran Unitate Mașină Android Auto */}
        <div className="xl:col-span-8 bg-slate-950 rounded-2xl border border-slate-800 p-5 sm:p-6 flex flex-col justify-between min-h-[420px] text-slate-100">
          {/* Bară superioară Android Auto */}
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800/90 text-xs text-slate-400">
            <div className="flex items-center gap-3 min-w-0">
              <Car className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="font-medium text-slate-200 truncate">
                {aaConnected ? 'Android Auto · Proiecție activă' : 'Unitate multimedia · Fără telefon conectat'}
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
              <span>{iphoneInRange ? `${currentRssi} dBm` : 'Fără BLE'}</span>
              <span aria-hidden="true">·</span>
              <span>{nowTimeString().slice(0, 5)}</span>
            </div>
          </div>

          {/* Conținut central Head-Unit */}
          <div className="flex-1 flex flex-col justify-center py-6">
            {!aaConnected ? (
              <div className="text-center space-y-3 py-8">
                <Car className="w-10 h-10 text-slate-600 mx-auto" />
                <h2 className="text-lg font-semibold text-slate-200">
                  Android Auto deconectat
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Conectează telefonul Android prin USB sau Wireless pentru a porni automat monitorizarea telefonului Apple aflat în habitaclu.
                </p>
              </div>
            ) : callState === 'ringing_aa' ? (
              <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-400">
                      <PhoneIncoming className="w-4 h-4" />
                      <span>Apel preluat de pe iPhone ({config.applePhoneNumber})</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      {incomingCallerName}
                    </h2>
                    <div className="text-sm font-mono tabular-nums text-slate-300">
                      {incomingCallerNumber} · Sursă: {config.appleDeviceName}
                    </div>
                  </div>
                  {autoAnswerCountdown !== null && (
                    <div className="text-xs font-mono tabular-nums text-amber-300 shrink-0">
                      Răspuns automat în {autoAnswerCountdown}s
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleAnswerOnAA}
                    className="inline-flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    Răspunde pe mașină
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectOrEnd}
                    className="inline-flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Respinge
                  </button>
                </div>
              </div>
            ) : callState === 'active_aa' ? (
              <div className="bg-slate-900 border border-emerald-700/60 rounded-xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                      <PhoneCall className="w-4 h-4" />
                      <span>Apel activ pe Android Auto · Difuzoare mașină</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      {incomingCallerName}
                    </h2>
                    <div className="text-sm font-mono tabular-nums text-slate-300">
                      {incomingCallerNumber} · via {config.applePhoneNumber}
                    </div>
                  </div>
                  <div className="text-2xl font-mono tabular-nums font-semibold text-emerald-400">
                    {formatCallDuration(callDurationSec)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    className={`inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                      muted
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                    }`}
                  >
                    {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {muted ? 'Microfon oprit' : 'Mut'}
                  </button>
                  <div className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800/60 text-slate-300 text-xs font-medium">
                    <Volume2 className="w-4 h-4 text-blue-400 shrink-0" />
                    Audio Mașină
                  </div>
                  <button
                    type="button"
                    onClick={handleRejectOrEnd}
                    className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Închide
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panou navigație contextual Android Auto */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between min-h-[210px]">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5 text-slate-200 font-medium">
                      <Navigation className="w-3.5 h-3.5 text-blue-400" />
                      Navigație
                    </span>
                    <span className="font-mono tabular-nums">12 km · 16 min</span>
                  </div>
                  <div className="space-y-1 my-4">
                    <div className="text-lg font-semibold text-white">
                      Bd. Aviatorilor · Înainte 1.4 km
                    </div>
                    <div className="text-xs text-slate-400">
                      Trafic fluent · Destinație Birou Central
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full w-2/3 bg-blue-500 rounded-full" />
                  </div>
                </div>

                {/* Panou AutoBridge AA pe Android Auto */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between min-h-[210px]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{config.appDisplayName}</span>
                    <span
                      className={`font-medium ${
                        bridgeActive ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {bridgeActive ? 'Preluare activă' : 'iPhone departe'}
                    </span>
                  </div>

                  <div className="space-y-2 my-3">
                    <div className="text-xs text-slate-400">Număr Apple monitorizat</div>
                    <div className="text-lg font-mono tabular-nums font-semibold text-white">
                      {config.applePhoneNumber}
                    </div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      {config.appleDeviceName} · {currentRssi} dBm ({iphoneDistance.toFixed(1)} m)
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                    {callState === 'ringing_iphone_only'
                      ? 'Apel activ doar pe iPhone (în afara razei BLE setate).'
                      : bridgeActive
                      ? 'Gata să preia automat apelurile sosite pe iPhone.'
                      : `Apropie telefonul Apple (prag: ${config.rssiThresholdDbm} dBm).`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bară inferioară tipică Android Auto */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800/90 text-xs text-slate-400">
            <span>Serviciu: AutoBridgeCarAppService</span>
            <span className="font-mono tabular-nums">
              Prag: {config.rssiThresholdDbm} dBm · Mod:{' '}
              {config.bridgeMode === 'ios_shortcut_forwarding' ? 'BLE+iOS' : 'HFP'}
            </span>
          </div>
        </div>

        {/* Panou control simulare dispozitive fizice */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-slate-900">
              Controale simulare dispozitive
            </h2>

            {/* Conexiune Android Auto */}
            <div className="space-y-2 pb-5 border-b border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">Conexiune Android Auto</span>
                <span
                  className={`text-xs font-medium ${
                    aaConnected ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  {aaConnected ? 'Conectat' : 'Deconectat'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleAndroidAuto}
                className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                  aaConnected
                    ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                    : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {aaConnected ? 'Deconectează de la Android Auto' : 'Conectează la Android Auto'}
              </button>
            </div>

            {/* Distanță iPhone Apple */}
            <div className="space-y-2.5 pb-5 border-b border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                  <Bluetooth className="w-4 h-4 text-blue-600" />
                  Distanță iPhone Apple
                </span>
                <span className="font-mono tabular-nums text-xs font-semibold text-slate-900">
                  {iphoneDistance.toFixed(1)} m · {currentRssi} dBm
                </span>
              </div>

              <input
                type="range"
                min={0.3}
                max={12}
                step={0.1}
                value={iphoneDistance}
                onChange={(e) => setIphoneDistance(Number(e.target.value))}
                aria-label="Distanță telefon Apple în metri"
                className="w-full accent-blue-600 cursor-pointer"
              />

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>În habitaclu (0.3 m)</span>
                <span
                  className={
                    iphoneInRange ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'
                  }
                >
                  {iphoneInRange ? 'În raza BLE' : 'În afara razei'}
                </span>
                <span>Departe (12 m)</span>
              </div>
            </div>

            {/* Simulare apel pe iPhone */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                <Smartphone className="w-4 h-4 text-slate-500" />
                <span>Simulare apel primit pe iPhone</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <input
                  type="text"
                  value={incomingCallerName}
                  onChange={(e) => setIncomingCallerName(e.target.value)}
                  aria-label="Nume apelant"
                  placeholder="Nume apelant"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                <input
                  type="tel"
                  value={incomingCallerNumber}
                  onChange={(e) => setIncomingCallerNumber(e.target.value)}
                  aria-label="Număr apelant"
                  placeholder="+40 731 804 210"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <button
                type="button"
                onClick={handleSimulateIncomingCall}
                disabled={callState === 'ringing_aa' || callState === 'active_aa'}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                Simulează apel către {config.applePhoneNumber}
              </button>

              {callState === 'ringing_iphone_only' && (
                <div className="flex items-center justify-between gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span>Sună doar pe iPhone (condiție neîndeplinită).</span>
                  <button
                    type="button"
                    onClick={handleRejectOrEnd}
                    className="font-semibold underline shrink-0"
                  >
                    Oprește
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabel jurnal evenimente State Machine */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Jurnal tranziții serviciu (CallBridgeForegroundService)
          </h2>
          <button
            type="button"
            onClick={() => setLogs([])}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            Golește jurnalul
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            Nu există evenimente înregistrate. Conectează Android Auto sau simulează un apel pentru a observa tranzițiile.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6 w-28">Ora</th>
                  <th className="py-2.5 px-4 w-40">Componentă</th>
                  <th className="py-2.5 px-4 w-28">Nivel</th>
                  <th className="py-2.5 px-6">Descriere eveniment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-6 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                      {entry.timestamp}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {entry.source}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium whitespace-nowrap">
                      <span
                        className={
                          entry.level === 'nominal'
                            ? 'text-emerald-700'
                            : entry.level === 'warning'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }
                      >
                        {entry.level === 'nominal'
                          ? 'Activ'
                          : entry.level === 'warning'
                          ? 'Atenție'
                          : 'Blocat'}
                      </span>
                    </td>
                    <td className="py-2.5 px-6 text-xs text-slate-700">
                      {entry.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
