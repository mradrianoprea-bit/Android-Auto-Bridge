import {
  Car,
  Code2,
  PackageCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { BridgeConfig, WorkspaceTab } from '../types/bridge';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  config: BridgeConfig;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  subtitle: string;
  icon: typeof SlidersHorizontal;
}> = [
  {
    id: 'config',
    label: 'Configurare și reguli',
    subtitle: 'Număr Apple, proximitate BLE, semnare',
    icon: SlidersHorizontal,
  },
  {
    id: 'simulator',
    label: 'Simulator Android Auto',
    subtitle: 'Testare preluare apeluri în habitaclu',
    icon: Car,
  },
  {
    id: 'code',
    label: 'Cod sursă Kotlin',
    subtitle: 'Proiect Android Studio și Gradle',
    icon: Code2,
  },
  {
    id: 'build',
    label: 'Compilare și semnare APK',
    subtitle: 'Export ZIP, semnare RSA și ghid iOS',
    icon: PackageCheck,
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  config,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          {config.appDisplayName || 'AutoBridge AA'}
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Închide meniul"
          className="lg:hidden p-2 -mr-2 text-slate-500 hover:text-slate-900 rounded-md focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="Navigare principală" className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isActive
                  ? 'bg-blue-50/90 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }`}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium leading-snug truncate">
                  {item.label}
                </div>
                <div className="text-xs text-slate-500 leading-snug mt-0.5 truncate">
                  {item.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="px-6 py-5 border-t border-slate-200 space-y-2.5 text-xs">
        <div className="text-slate-500 font-medium">Rezumat configurație</div>
        <div className="space-y-1.5 text-slate-600">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">iPhone</span>
            <span className="font-mono tabular-nums text-slate-900 truncate">
              {config.applePhoneNumber || 'Nesetat'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Prag BLE</span>
            <span className="font-mono tabular-nums text-slate-900">
              {config.rssiThresholdDbm} dBm
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Pachet</span>
            <span className="font-mono text-slate-900 truncate max-w-[140px]">
              {config.applicationId}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:w-[272px] lg:shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-[280px] max-w-[85vw] h-full z-10">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
