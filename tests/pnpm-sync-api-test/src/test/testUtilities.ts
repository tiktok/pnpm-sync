import path from 'path';
import { Lockfile, readWantedLockfile } from '@pnpm/lockfile-file';
import { Path } from '@rushstack/node-core-library';
import type { ILockfile, ILockfilePackage } from 'pnpm-sync-lib';

export async function readPnpmLockfile(
  lockfilePath: string,
  options: {
    ignoreIncompatible: boolean;
  }
): Promise<ILockfile | undefined> {
  const pnpmLockFolder = path.dirname(lockfilePath);
  const lockfile: Lockfile | null = await readWantedLockfile(pnpmLockFolder, options);

  if (lockfile === null) {
    return undefined;
  } else {
    const lockfilePackages: Record<string, ILockfilePackage> = lockfile.packages as Record<
      string,
      ILockfilePackage
    >;
    const result: ILockfile = {
      lockfileVersion: lockfile.lockfileVersion,
      importers: lockfile.importers,
      packages: lockfilePackages
    };
    return result;
  }
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
      case 'projectFolder':
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
