export type WorkspaceTab = 'config' | 'simulator' | 'code' | 'build';

export type BridgeMode = 'ancs_busy_forward' | 'ancs_signal_only' | 'hfp_telecom_bridge';

export interface BridgeConfig {
  // Numărul telefonului Apple (iPhone) de pe care se preiau apelurile
  applePhoneNumber: string;
  // Numărul telefonului Android conectat la Android Auto (destinația redirecționării *67*)
  androidPhoneNumber: string;
  // Numele Bluetooth al dispozitivului Apple asociat
  appleDeviceName: string;
  // Adresa MAC Bluetooth opțională a iPhone-ului (se poate alege și din aplicația Android)
  appleDeviceAddress: string;
  // Pragul de proximitate BLE RSSI în dBm (ex: -72 dBm ≈ 2.5 metri în habitaclu)
  rssiThresholdDbm: number;
  // Modul de preluare a apelurilor
  bridgeMode: BridgeMode;
  // Preluare automată pe Android Auto după un interval scurt
  autoAnswerEnabled: boolean;
  autoAnswerDelaySec: number;
  // Oprește preluarea automată la deconectarea de la Android Auto
  autoRevertOnDisconnect: boolean;
  // Filtru strict: verifică prezența iPhone-ului asociat în proximitate
  strictAppleNumberMatch: boolean;
  // Parametri de compilare și semnare APK
  applicationId: string;
  appDisplayName: string;
  versionName: string;
  versionCode: number;
  keystoreAlias: string;
  organizationName: string;
}

export interface ProjectFile {
  path: string;
  language: 'kotlin' | 'xml' | 'gradle' | 'bash' | 'yaml' | 'markdown' | 'properties';
  category: 'Gradle & Build' | 'Manifest & Resurse' | 'Cod Kotlin' | 'Semnare & CI/CD';
  description: string;
  content: string;
}

export type CallState = 'idle' | 'ringing_iphone_only' | 'ringing_aa' | 'active_aa';

export interface SimulatorLogEntry {
  id: string;
  timestamp: string;
  source: 'Android Auto' | 'BLE ANCS' | 'Punte Apeluri' | 'iPhone Apple';
  level: 'nominal' | 'warning' | 'alert';
  message: string;
}

export const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  applePhoneNumber: '+40 722 450 890',
  androidPhoneNumber: '+40 744 112 300',
  appleDeviceName: 'iPhone 15 Pro — Adrian',
  appleDeviceAddress: '',
  rssiThresholdDbm: -72,
  bridgeMode: 'ancs_busy_forward',
  autoAnswerEnabled: false,
  autoAnswerDelaySec: 2,
  autoRevertOnDisconnect: true,
  strictAppleNumberMatch: true,
  applicationId: 'ro.autobridge.applecall',
  appDisplayName: 'AutoBridge AA',
  versionName: '1.1.0',
  versionCode: 2,
  keystoreAlias: 'autobridge-release',
  organizationName: 'AutoBridge Mobile',
};
