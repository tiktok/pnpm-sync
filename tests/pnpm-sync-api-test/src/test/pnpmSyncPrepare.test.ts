import fs from 'fs';
import path from 'path';
import { FileSystem } from '@rushstack/node-core-library';
import {
  pnpmSyncPrepareAsync,
  ILogMessageCallbackOptions,
  LogMessageIdentifier,
  pnpmSyncGetJsonVersion
} from 'pnpm-sync-lib';
import { readPnpmLockfile, scrubLog } from './testUtilities';

const pnpmSyncLibVersion: string = pnpmSyncGetJsonVersion();

describe('pnpm-sync-api prepare test', () => {
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
      ensureFolderAsync: FileSystem.ensureFolderAsync,
      readPnpmLockfile,
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
      version: pnpmSyncLibVersion,
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
      version: pnpmSyncLibVersion,
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

  it('pnpmSyncPrepareAsync should detect outdated .pnpm-sync.json version', async () => {
    const lockfilePath = '../../pnpm-lock.yaml';
    const dotPnpmFolder = '../../node_modules/.pnpm';

    const pnpmSyncJsonFolder = `../test-fixtures/sample-lib1/node_modules`;
    const pnpmSyncJsonPath = `${pnpmSyncJsonFolder}/.pnpm-sync.json`;

    if (!fs.existsSync(pnpmSyncJsonFolder)) {
      await FileSystem.ensureFolderAsync(pnpmSyncJsonFolder);
    }

    // create an incompatible .pnpm-sync.json for testing
    const fakePnpmSyncJsonFile = {
      version: 'incompatible-version',
      postbuildInjectedCopy: {
        sourceFolder: '..',
        targetFolders: ['../../../../node_modules/.pnpm/fake+folder']
      }
    };

    // write a fake .pnpm-sync.json
    await fs.promises.writeFile(pnpmSyncJsonPath, JSON.stringify(fakePnpmSyncJsonFile, null, 2));

    const logs: ILogMessageCallbackOptions[] = [];

    await pnpmSyncPrepareAsync({
      lockfilePath: lockfilePath,
      dotPnpmFolder: dotPnpmFolder,
      ensureFolderAsync: FileSystem.ensureFolderAsync,
      readPnpmLockfile,
      logMessageCallback: (options: ILogMessageCallbackOptions): void => {
        // in this test case, we only care projects under tests/test-fixtures/sample-lib1 folder
        // and the logs related to write files
        if (
          options.details.messageIdentifier === LogMessageIdentifier.PREPARE_REPLACING_FILE &&
          options.details.projectFolder
            .split(path.sep)
            .join(path.posix.sep)
            .includes('tests/test-fixtures/sample-lib1')
        ) {
          logs.push(options);
        }
      }
    });

    expect(logs.map((x) => scrubLog(x))).toMatchInlineSnapshot(`
      Array [
        Object {
          "details": Object {
            "actualVersion": "incompatible-version",
            "expectedVersion": "${pnpmSyncLibVersion}",
            "messageIdentifier": "prepare-replacing-file",
            "pnpmSyncJsonPath": "<root>/pnpm-sync/tests/test-fixtures/sample-lib1/node_modules/.pnpm-sync.json",
            "projectFolder": "<root>/pnpm-sync/tests/test-fixtures/sample-lib1",
          },
          "message": "The...",
          "messageKind": "verbose",
        },
      ]
    `);

    // now, read .pnpm-sync.json and check the fields
    expect(fs.existsSync(pnpmSyncJsonPath)).toBe(true);

    // the fake a .pnpm-sync.json should be replaced with the correct one
    expect(JSON.parse(fs.readFileSync(pnpmSyncJsonPath).toString())).toEqual({
      version: pnpmSyncLibVersion,
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
  });

  it('pnpmSyncPrepareAsync should handle identifier (if provided)', async () => {
    const lockfilePath = '../../pnpm-lock.yaml';
    const dotPnpmFolder = '../../node_modules/.pnpm';

    const pnpmSyncJsonFolder = `../test-fixtures/sample-lib1/node_modules`;
    const pnpmSyncJsonPath = `${pnpmSyncJsonFolder}/.pnpm-sync.json`;

    if (!fs.existsSync(pnpmSyncJsonFolder)) {
      await FileSystem.ensureFolderAsync(pnpmSyncJsonFolder);
    }

    // create an .pnpm-sync.json with some identifiers
    const pnpmSyncJsonFile = {
      version: pnpmSyncLibVersion,
      postbuildInjectedCopy: {
        sourceFolder: '..',
        targetFolders: [
          {
            folderPath:
              '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib1_react@17.0.2/node_modules/api-demo-sample-lib1',
            lockfileId: 'identifier1'
          },
          {
            folderPath:
              '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib1_react@17.0.2/node_modules/api-demo-sample-lib2',
            lockfileId: 'identifier1'
          },
          {
            folderPath:
              '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib1_react@17.0.2/node_modules/api-demo-sample-lib3',
            lockfileId: 'identifier2'
          }
        ]
      }
    };

    // write .pnpm-sync.json
    await fs.promises.writeFile(pnpmSyncJsonPath, JSON.stringify(pnpmSyncJsonFile, null, 2));

    await pnpmSyncPrepareAsync({
      lockfilePath: lockfilePath,
      dotPnpmFolder: dotPnpmFolder,
      lockfileId: 'identifier1',
      ensureFolderAsync: FileSystem.ensureFolderAsync,
      readPnpmLockfile,
      logMessageCallback: (): void => {}
    });

    // now, read .pnpm-sync.json and check the fields
    expect(fs.existsSync(pnpmSyncJsonPath)).toBe(true);

    // the folderPath with identifier1 should be regenerated
    // the folderPath with identifier2 should keep as it is
    expect(JSON.parse(fs.readFileSync(pnpmSyncJsonPath).toString())).toEqual({
      version: pnpmSyncLibVersion,
      postbuildInjectedCopy: {
        sourceFolder: '..',
        targetFolders: [
          {
            folderPath:
              '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib1_react@17.0.2/node_modules/api-demo-sample-lib3',
            lockfileId: 'identifier2'
          },
          {
            folderPath:
              '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib1_react@17.0.2/node_modules/api-demo-sample-lib1',
            lockfileId: 'identifier1'
          }
        ]
      }
    });
  });
});
