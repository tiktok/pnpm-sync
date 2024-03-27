import fs from 'fs';
import path from 'path';
import { FileSystem } from '@rushstack/node-core-library';
import { readWantedLockfile, Lockfile } from '@pnpm/lockfile-file';
import {
  type ILockfile,
  type ILockfilePackage,
  pnpmSyncPrepareAsync,
  ILogMessageCallbackOptions
} from 'pnpm-sync-lib';

describe('pnpm-sync-api test', () => {
  it('pnpmSyncPrepareAsync should generate .pnpm-sync.json under node_modules folder', async () => {
    const lockfilePath = '../pnpm-lock.yaml';
    const dotPnpmFolder = '../node_modules/.pnpm';

    const dotPnpmSyncJsonPathForSampleLib1: string = 'test-fixtures/sample-lib1/node_modules/.pnpm-sync.json';
    const dotPnpmSyncJsonPathForSampleLib2: string = 'test-fixtures/sample-lib2/node_modules/.pnpm-sync.json';

    // if .pnpm-sync.json already exists, delete it first
    if (fs.existsSync(dotPnpmSyncJsonPathForSampleLib1)) {
      fs.unlinkSync(dotPnpmSyncJsonPathForSampleLib1);
    }
    if (fs.existsSync(dotPnpmSyncJsonPathForSampleLib2)) {
      fs.unlinkSync(dotPnpmSyncJsonPathForSampleLib2);
    }

    expect(fs.existsSync(dotPnpmSyncJsonPathForSampleLib1)).toBe(false);
    expect(fs.existsSync(dotPnpmSyncJsonPathForSampleLib2)).toBe(false);

    await pnpmSyncPrepareAsync({
      lockfilePath: lockfilePath,
      dotPnpmFolder: dotPnpmFolder,
      ensureFolder: FileSystem.ensureFolderAsync,
      readPnpmLockfile: async (
        lockfilePath: string,
        options: {
          ignoreIncompatible: boolean;
        }
      ) => {
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
      },
      logMessageCallback: (options: ILogMessageCallbackOptions): void => {
        console.log(options.message);
      }
    });

    // now, read .pnpm-sync.json and check the fields
    expect(fs.existsSync(dotPnpmSyncJsonPathForSampleLib1)).toBe(true);
    expect(fs.existsSync(dotPnpmSyncJsonPathForSampleLib2)).toBe(true);

    expect(JSON.parse(fs.readFileSync(dotPnpmSyncJsonPathForSampleLib1).toString())).toEqual({
      postbuildInjectedCopy: {
        sourceFolder: '..',
        targetFolders: [
          {
            folderPath:
              '../../../../node_modules/.pnpm/file+pnpm-sync-api-demo+test-fixtures+sample-lib1_react@17.0.2/node_modules/api-demo-sample-lib1'
          }
        ]
      }
    });

    expect(JSON.parse(fs.readFileSync(dotPnpmSyncJsonPathForSampleLib2).toString())).toEqual({
      postbuildInjectedCopy: {
        sourceFolder: '..',
        targetFolders: [
          {
            folderPath:
              '../../../../node_modules/.pnpm/file+pnpm-sync-api-demo+test-fixtures+sample-lib2_react@17.0.2/node_modules/api-demo-sample-lib2'
          }
        ]
      }
    });
  });
});
