import path from 'path';
import { readWantedLockfile as readWantedLockfileV6 } from '@pnpm/lockfile-file-pnpm-lock-v6';
import { readWantedLockfile as readWantedLockfileV9 } from '@pnpm/lockfile.fs-pnpm-lock-v9';
import { Path } from '@rushstack/node-core-library';
import type { ILockfile } from 'pnpm-sync-lib';
import { fileURLToPath } from 'url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function readPnpmLockfile(
  lockfilePath: string,
  options: {
    ignoreIncompatible: boolean;
  }
): Promise<ILockfile | undefined> {
  const pnpmLockFolder = path.dirname(lockfilePath);
  const lockfileV6 = await readWantedLockfileV6(pnpmLockFolder, options);

  if (lockfileV6?.lockfileVersion.toString().startsWith('6')) {
    return lockfileV6;
  }

  const lockfileV9 = await readWantedLockfileV9(pnpmLockFolder, options);

  if (lockfileV9?.lockfileVersion.toString().startsWith('9')) {
    return lockfileV9;
  }

  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scrubLog(log: Record<string, any>): Record<string, any> {
  const scrubbedLog = { ...log };
  const repoRootFolder = path.join(__dirname, '..', '..', '..', '..', '..');
  for (const key of Object.keys(scrubbedLog)) {
    switch (key) {
      case 'message':
        scrubbedLog[key] = scrubbedLog[key].split(' ')[0] + '...';
        break;
      case 'details':
        scrubbedLog[key] = scrubLog(scrubbedLog[key]);
        break;
      case 'executionTimeInMs':
        scrubbedLog[key] = '[TIMING]';
        break;

      case 'dotPnpmFolder':
      case 'dotPnpmFolderPath':
      case 'lockfilePath':
      case 'pnpmSyncJsonPath':
      case 'sourceProjectFolder':
      case 'sourcePath':
        let scrubbedPath = scrubbedLog[key];
        scrubbedPath = scrubbedPath.replace(repoRootFolder, '<root>');
        scrubbedPath = Path.convertToSlashes(scrubbedPath);
        scrubbedLog[key] = scrubbedPath;
        break;
    }
  }
  return scrubbedLog;
}
