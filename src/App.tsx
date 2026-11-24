/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Download, Menu } from 'lucide-react';
import { BridgeConfig, DEFAULT_BRIDGE_CONFIG, WorkspaceTab } from './types/bridge';
import { Sidebar } from './components/Sidebar';
import { ConfigWorkspace } from './components/ConfigWorkspace';
import { AndroidAutoSimulator } from './components/AndroidAutoSimulator';
import { SourceCodeExplorer } from './components/SourceCodeExplorer';
import { ApkBuildGuide } from './components/ApkBuildGuide';
import { downloadAndroidProjectZip } from './lib/zipExporter';

const STORAGE_KEY = 'autobridge_aa_config_v1';

const TAB_LABELS: Record<WorkspaceTab, string> = {
  config: 'Configurare și reguli',
  simulator: 'Simulator Android Auto',
  code: 'Cod sursă Kotlin',
  build: 'Compilare și semnare APK',
};

function loadInitialConfig(): BridgeConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BRIDGE_CONFIG;
    const parsed = JSON.parse(raw) as Partial<BridgeConfig>;
    return { ...DEFAULT_BRIDGE_CONFIG, ...parsed };
  } catch {
    return DEFAULT_BRIDGE_CONFIG;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('config');
  const [config, setConfig] = useState<BridgeConfig>(loadInitialConfig);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExportFile, setLastExportFile] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignoră dacă localStorage nu este disponibil
    }
  }, [config]);

  const handleDownloadZip = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const fileName = await downloadAndroidProjectZip(config);
      setLastExportFile(fileName);
    } catch (err) {
      setExportError(
        err instanceof Error
          ? err.message
          : 'Nu s-a putut genera arhiva ZIP a proiectului Android.'
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        config={config}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Bară superioară conform contractului SaaS: breadcrumb stânga + 1 acțiune primară dreapta */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Deschide meniul de navigare"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap shrink-0">
                {config.appDisplayName || 'AutoBridge AA'}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 truncate">
                {TAB_LABELS[activeTab]}
              </span>
            </nav>
          </div>

          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Se exportă...' : 'Descarcă pachet APK (.zip)'}
          </button>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-8">
          {exportError && (
            <div className="max-w-5xl mx-auto mb-6 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3">
              {exportError}
            </div>
          )}

          {activeTab === 'config' && (
            <ConfigWorkspace
              config={config}
              onChange={setConfig}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'simulator' && <AndroidAutoSimulator config={config} />}

          {activeTab === 'code' && (
            <SourceCodeExplorer
              config={config}
              onDownloadZip={handleDownloadZip}
              exporting={exporting}
            />
          )}

          {activeTab === 'build' && (
            <ApkBuildGuide
              config={config}
              onDownloadZip={handleDownloadZip}
              exporting={exporting}
              lastExportFile={lastExportFile}
            />
          )}
        </main>
      </div>
    </div>
  );
}
