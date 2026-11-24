import JSZip from 'jszip';
import { BridgeConfig } from '../types/bridge';
import { generateAndroidProjectFiles } from './androidProjectGenerator';

export async function downloadAndroidProjectZip(config: BridgeConfig): Promise<string> {
  const zip = new JSZip();
  const rootFolderName = `AutoBridgeAA-v${config.versionName.replace(/[^a-zA-Z0-9._-]/g, '') || '1.0.0'}`;
  const folder = zip.folder(rootFolderName);

  if (!folder) {
    throw new Error('Nu s-a putut inițializa arhiva proiectului Android.');
  }

  const files = generateAndroidProjectFiles(config);
  for (const file of files) {
    folder.file(file.path, file.content, {
      unixPermissions: file.path.endsWith('.sh') ? '755' : '644',
    });
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'UNIX',
  });

  const fileName = `${rootFolderName}-Android-APK-Project.zip`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return fileName;
}
