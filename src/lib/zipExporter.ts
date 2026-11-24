import JSZip from 'jszip';
import { BridgeConfig } from '../types/bridge';
import { generateAndroidProjectFiles, sanitizeVersionTag } from './androidProjectGenerator';

export function getExportArchiveNames(config: BridgeConfig): {
  rootFolderName: string;
  zipFileName: string;
} {
  const versionTag = sanitizeVersionTag(config.versionName);
  const rootFolderName = `AutoBridgeAA-v${versionTag}`;
  return {
    rootFolderName,
    zipFileName: `${rootFolderName}-Android-APK-Project.zip`,
  };
}

export async function buildAndroidProjectZip(config: BridgeConfig): Promise<{
  zip: JSZip;
  rootFolderName: string;
  zipFileName: string;
}> {
  const zip = new JSZip();
  const { rootFolderName, zipFileName } = getExportArchiveNames(config);
  const folder = zip.folder(rootFolderName);

  if (!folder) {
    throw new Error('Nu s-a putut inițializa arhiva proiectului Android.');
  }

  const files = generateAndroidProjectFiles(config);
  for (const file of files) {
    folder.file(file.path, file.content, {
      unixPermissions: file.path.endsWith('.sh') ? 0o100755 : 0o100644,
    });
  }

  return { zip, rootFolderName, zipFileName };
}

export async function downloadAndroidProjectZip(config: BridgeConfig): Promise<string> {
  const { zip, zipFileName } = await buildAndroidProjectZip(config);

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'UNIX',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = zipFileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return zipFileName;
}
