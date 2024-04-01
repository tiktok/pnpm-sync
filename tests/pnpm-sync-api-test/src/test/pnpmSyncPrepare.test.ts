import fs from 'fs';
import path from 'path';
import { FileSystem, Path } from '@rushstack/node-core-library';
import { readWantedLockfile, Lockfile } from '@pnpm/lockfile-file';
import {
  type ILockfile,
  type ILockfilePackage,
  pnpmSyncPrepareAsync,
  ILogMessageCallbackOptions,
  LogMessageIdentifier
} from 'pnpm-sync-lib';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scrubLog(log: Record<string, any>): Record<string, any> {
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

describe('pnpm-sync-api test', () => {
  it('pnpmSyncPrepareAsync should generate .pnpm-sync.json under node_modules folder', async () => {
    const lockfilePath = '../../pnpm-lock.yaml';
    const dotPnpmFolder = '../../node_modules/.pnpm';

    const dotPnpmSyncJsonPathForSampleLib1: string =
      '../test-fixtures/sample-lib1/node_modules/.pnpm-sync.json';
    const dotPnpmSyncJsonPathForSampleLib2: string =
      '../test-fixtures/sample-lib2/node_modules/.pnpm-sync.json';

    // if .pnpm-sync.json already exists, delete it first
    if (fs.existsSync(dotPnpmSyncJsonPathForSampleLib1)) {
      fs.unlinkSync(dotPnpmSyncJsonPathForSampleLib1);
    }
    if (fs.existsSync(dotPnpmSyncJsonPathForSampleLib2)) {
      fs.unlinkSync(dotPnpmSyncJsonPathForSampleLib2);
    }

    expect(fs.existsSync(dotPnpmSyncJsonPathForSampleLib1)).toBe(false);
    expect(fs.existsSync(dotPnpmSyncJsonPathForSampleLib2)).toBe(false);

    const logs: ILogMessageCallbackOptions[] = [];

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
        // in this test case, we only care projects under tests/test-fixtures folder
        if (
          options.details.messageIdentifier !== LogMessageIdentifier.PREPARE_WRITING_FILE ||
          options.details.projectFolder.split(path.sep).join(path.posix.sep).includes('tests/test-fixtures')
        ) {
          logs.push(options);
        }
      }
    });

    expect(logs.map((x) => scrubLog(x))).toMatchInlineSnapshot(`
      Array [
        Object {
          "details": Object {
            "dotPnpmFolder": "<root>/pnpm-sync/node_modules/.pnpm",
            "lockfilePath": "<root>/pnpm-sync/pnpm-lock.yaml",
            "messageIdentifier": "prepare-starting",
          },
          "message": "Starting...",
          "messageKind": "verbose",
        },
        Object {
          "details": Object {
            "messageIdentifier": "prepare-writing-file",
            "pnpmSyncJsonPath": "<root>/pnpm-sync/tests/test-fixtures/sample-lib1/node_modules/.pnpm-sync.json",
            "projectFolder": "<root>/pnpm-sync/tests/test-fixtures/sample-lib1",
          },
          "message": "Writing...",
          "messageKind": "verbose",
        },
        Object {
          "details": Object {
            "messageIdentifier": "prepare-writing-file",
            "pnpmSyncJsonPath": "<root>/pnpm-sync/tests/test-fixtures/sample-lib2/node_modules/.pnpm-sync.json",
            "projectFolder": "<root>/pnpm-sync/tests/test-fixtures/sample-lib2",
          },
          "message": "Writing...",
          "messageKind": "verbose",
        },
        Object {
          "details": Object {
            "dotPnpmFolder": "<root>/pnpm-sync/node_modules/.pnpm",
            "executionTimeInMs": "[TIMING]",
            "lockfilePath": "<root>/pnpm-sync/pnpm-lock.yaml",
            "messageIdentifier": "prepare-finishing",
          },
          "message": "Regenerated...",
          "messageKind": "info",
        },
      ]
    `);

    // now, read .pnpm-sync.json and check the fields
    expect(fs.existsSync(dotPnpmSyncJsonPathForSampleLib1)).toBe(true);
    expect(fs.existsSync(dotPnpmSyncJsonPathForSampleLib2)).toBe(true);

    expect(JSON.parse(fs.readFileSync(dotPnpmSyncJsonPathForSampleLib1).toString())).toEqual({
      postbuildInjectedCopy: {
        sourceFolder: '..',
        targetFolders: [
          {
            folderPath:
              '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib1_react@17.0.2/node_modules/api-demo-sample-lib1'
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
              '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib2_react@17.0.2/node_modules/api-demo-sample-lib2'
          }
        ]
      }
    });
  });
});
