import fs from 'fs';
import path from 'path';
import { Async, FileSystem } from '@rushstack/node-core-library';
import { PackageExtractor } from '@rushstack/package-extractor';
import { readPnpmLockfile, scrubLog } from './testUtilities';
import {
  ILogMessageCallbackOptions,
  getPnpmSyncJsonVersion,
  pnpmSyncCopyAsync,
  pnpmSyncPrepareAsync
} from 'pnpm-sync-lib';

const pnpmSyncLibVersion: string = getPnpmSyncJsonVersion();

describe('pnpm-sync-api copy test', () => {
  it('pnpmSyncCopyAsync should copy files based on .pnpm-sync.json under node_modules folder', async () => {
    const lockfilePath = '../../pnpm-lock.yaml';
    const dotPnpmFolder = '../../node_modules/.pnpm';

    const pnpmSyncJsonFolder = `../test-fixtures/sample-lib1/node_modules`;
    const pnpmSyncJsonPath = `${pnpmSyncJsonFolder}/.pnpm-sync.json`;
    const targetFolderPath =
      '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib1_react@17.0.2/node_modules/api-demo-sample-lib1';
    // generate .pnpm-sync.json file first.
    await pnpmSyncPrepareAsync({
      lockfilePath: lockfilePath,
      dotPnpmFolder: dotPnpmFolder,
      ensureFolder: FileSystem.ensureFolderAsync,
      readPnpmLockfile,
      logMessageCallback: (): void => {}
    });

    // make sure .pnpm-sync.json exists
    expect(fs.existsSync(pnpmSyncJsonPath)).toBe(true);

    const pnpmSyncJsonFile = JSON.parse(fs.readFileSync(pnpmSyncJsonPath).toString());
    expect(pnpmSyncJsonFile).toEqual({
      version: pnpmSyncLibVersion,
      postbuildInjectedCopy: {
        sourceFolder: '..',
        targetFolders: [
          {
            folderPath: targetFolderPath
          }
        ]
      }
    });

    // set a outdated version
    pnpmSyncJsonFile.version = 'outdated-version';
    await fs.promises.writeFile(pnpmSyncJsonPath, JSON.stringify(pnpmSyncJsonFile, null, 2));

    // if pnpmSyncCopyAsync detects a outdated version, should throw errors
    try {
      await pnpmSyncCopyAsync({
        pnpmSyncJsonPath,
        getPackageIncludedFiles: PackageExtractor.getPackageIncludedFilesAsync,
        forEachAsyncWithConcurrency: Async.forEachAsync,
        ensureFolder: FileSystem.ensureFolderAsync,
        logMessageCallback: () => {}
      });
    } catch (error) {
      expect(error.message).toContain('is outdated; regenerate it and try again');
    }

    // set the correct version
    pnpmSyncJsonFile.version = pnpmSyncLibVersion;
    await fs.promises.writeFile(pnpmSyncJsonPath, JSON.stringify(pnpmSyncJsonFile, null, 2));

    const destinationPath = path.resolve(pnpmSyncJsonFolder, targetFolderPath);

    // delete the destination folder
    await fs.promises.rm(destinationPath, { recursive: true, force: true });
    expect(fs.existsSync(destinationPath)).toBe(false);

    const logs: ILogMessageCallbackOptions[] = [];

    await pnpmSyncCopyAsync({
      pnpmSyncJsonPath,
      getPackageIncludedFiles: PackageExtractor.getPackageIncludedFilesAsync,
      forEachAsyncWithConcurrency: Async.forEachAsync,
      ensureFolder: FileSystem.ensureFolderAsync,
      logMessageCallback: (options: ILogMessageCallbackOptions): void => {
        logs.push(options);
      }
    });

    // after copy action, the destination folder should exists
    expect(fs.existsSync(destinationPath)).toBe(true);

    // check the log message
    expect(logs.map((x) => scrubLog(x))).toMatchInlineSnapshot(`
      Array [
        Object {
          "details": Object {
            "messageIdentifier": "copy-starting",
            "pnpmSyncJsonPath": "<root>/pnpm-sync/tests/test-fixtures/sample-lib1/node_modules/.pnpm-sync.json",
          },
          "message": "Starting...",
          "messageKind": "verbose",
        },
        Object {
          "details": Object {
            "executionTimeInMs": "[TIMING]",
            "fileCount": 6,
            "messageIdentifier": "copy-finishing",
            "pnpmSyncJsonPath": "<root>/pnpm-sync/tests/test-fixtures/sample-lib1/node_modules/.pnpm-sync.json",
            "sourcePath": "<root>/pnpm-sync/tests/test-fixtures/sample-lib1",
          },
          "message": "Synced...",
          "messageKind": "info",
        },
      ]
    `);
  });
});
