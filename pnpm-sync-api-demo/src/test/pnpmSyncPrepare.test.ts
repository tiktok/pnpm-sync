import fs from 'fs';
import {
  type ILockfile,
  type ILockfilePackage,
  pnpmSyncPrepareAsync,
  ILogMessageCallbackOptions
} from 'pnpm-sync-lib';
import { FileSystem } from '@rushstack/node-core-library';
import { readWantedLockfile, Lockfile } from '@pnpm/lockfile-file';

describe('pnpm-sync-api test', () => {
  it('pnpmSyncPrepareAsync should generate .pnpm-sync.json under pnpm-sync-cli-demo/lib1/node_modules', async () => {
    const lockfilePath = '../pnpm-lock.yaml';
    const dotPnpmFolder = '../node_modules/.pnpm';

    const expectedDotPnpmSyncJsonPath: string = '../pnpm-sync-cli-demo/lib1/node_modules/.pnpm-sync.json';

    // if .pnpm-sync.json already exists, delete it first
    if (fs.existsSync(expectedDotPnpmSyncJsonPath)) {
      fs.unlinkSync(expectedDotPnpmSyncJsonPath);
    }

    expect(fs.existsSync(expectedDotPnpmSyncJsonPath)).toBe(false);

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
        const pnpmLockFolder = lockfilePath.slice(0, lockfilePath.length - 'pnpm-lock.yaml'.length);

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

    expect(fs.existsSync(expectedDotPnpmSyncJsonPath)).toBe(true);

    const pnpmSyncJsonFile: {
      postbuildInjectedCopy: {
        sourceFolder: string;
        targetFolders: Array<{
          folderPath: string;
        }>;
      };
    } = JSON.parse(fs.readFileSync(expectedDotPnpmSyncJsonPath).toString());

    expect(pnpmSyncJsonFile).toEqual({
      postbuildInjectedCopy: {
        sourceFolder: '..',
        targetFolders: [
          {
            folderPath:
              '../../../node_modules/.pnpm/file+pnpm-sync-cli-demo+lib1_react@17.0.2/node_modules/lib1'
          }
        ]
      }
    });
  });
});
