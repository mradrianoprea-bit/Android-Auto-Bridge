import { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2, Search } from 'lucide-react';
import { BridgeConfig, ProjectFile } from '../types/bridge';
import { generateAndroidProjectFiles } from '../lib/androidProjectGenerator';

interface SourceCodeExplorerProps {
  config: BridgeConfig;
  onDownloadZip: () => void;
  exporting: boolean;
}

const CATEGORIES: Array<ProjectFile['category'] | 'Toate'> = [
  'Toate',
  'Cod Kotlin',
  'Gradle & Build',
  'Manifest & Resurse',
  'Semnare & CI/CD',
];

export function SourceCodeExplorer({
  config,
  onDownloadZip,
  exporting,
}: SourceCodeExplorerProps) {
  const files = useMemo(() => generateAndroidProjectFiles(config), [config]);
  const [selectedPath, setSelectedPath] = useState<string>(
    () => files.find((f) => f.path.endsWith('CallBridgeForegroundService.kt'))?.path || files[0].path
  );
  const [activeCategory, setActiveCategory] = useState<ProjectFile['category'] | 'Toate'>('Toate');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return files.filter((file) => {
      const matchesCat = activeCategory === 'Toate' || file.category === activeCategory;
      const matchesSearch =
        !q ||
        file.path.toLowerCase().includes(q) ||
        file.description.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [files, activeCategory, searchQuery]);

  const activeFile =
    files.find((f) => f.path === selectedPath) ||
    filteredFiles[0] ||
    files[0];

  const lines = useMemo(() => activeFile.content.split('\n'), [activeFile.content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedPath(activeFile.path);
      window.setTimeout(() => setCopiedPath(null), 1800);
    } catch {
      // Clipboard indisponibil în anumite medii iframe restricționate
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Cod sursă Android Kotlin și Gradle
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
            Proiect complet ({files.length} fișiere) generat dinamic cu numărul Apple{' '}
            <span className="font-mono tabular-nums text-slate-900 font-medium">
              {config.applePhoneNumber}
            </span>{' '}
            și semnarea release <span className="font-mono text-slate-900">{config.keystoreAlias}</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={onDownloadZip}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Se generează arhiva...' : 'Exportă tot proiectul (.zip)'}
        </button>
      </div>

      {/* Filtre categorii + căutare */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCategory === category
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută fișier Kotlin sau Gradle..."
            aria-label="Caută fișier în proiect"
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>
      </div>

      {/* Explorator split-pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[580px]">
        {/* Listă fișiere */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto max-h-[320px] lg:max-h-[680px]">
          {filteredFiles.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Niciun fișier nu corespunde filtrului curent.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredFiles.map((file) => {
                const isSelected = file.path === activeFile.path;
                const shortName = file.path.split('/').pop() || file.path;
                return (
                  <li key={file.path}>
                    <button
                      type="button"
                      onClick={() => setSelectedPath(file.path)}
                      className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 text-blue-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileCode2
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? 'text-blue-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="text-xs font-mono font-medium truncate">
                          {shortName}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate mt-1 pl-6">
                        {file.path}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Vizualizator cod */}
        <div className="lg:col-span-8 flex flex-col min-w-0 bg-slate-950 text-slate-100">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800 bg-slate-900/70">
            <div className="min-w-0">
              <div className="text-xs font-mono text-slate-100 truncate">
                {activeFile.path}
              </div>
              <div className="text-xs text-slate-400 truncate mt-0.5">
                {activeFile.description} · {lines.length} linii
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedPath === activeFile.path ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copiat
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiază fișierul
                </>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 max-h-[620px]">
            <pre className="text-xs leading-6 font-mono">
              <code>
                {lines.map((line, index) => (
                  <div key={index} className="table-row hover:bg-slate-900/80">
                    <span className="table-cell select-none pr-4 text-right text-slate-600 tabular-nums w-10">
                      {index + 1}
                    </span>
                    <span className="table-cell whitespace-pre text-slate-200">
                      {line || ' '}
                    </span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
