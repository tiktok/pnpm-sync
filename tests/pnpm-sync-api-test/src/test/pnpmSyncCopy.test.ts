import fs from 'fs';
import path from 'path';
import { Async, FileSystem } from '@rushstack/node-core-library';
import { PackageExtractor } from '@rushstack/package-extractor';
import { readPnpmLockfile, scrubLog } from './testUtilities';
import {
  ILogMessageCallbackOptions,
  pnpmSyncGetJsonVersion,
  pnpmSyncCopyAsync,
  pnpmSyncPrepareAsync
} from 'pnpm-sync-lib';

const pnpmSyncLibVersion: string = pnpmSyncGetJsonVersion();

describe('pnpm-sync-api copy test', () => {
  beforeAll(async () => {
    const lockfilePath = '../../pnpm-lock.yaml';
    const dotPnpmFolder = '../../node_modules/.pnpm';

    const pnpmSyncJsonFolder1 = `../test-fixtures/sample-lib1/node_modules`;
    const pnpmSyncJsonFolder2 = `../test-fixtures/sample-lib2/node_modules`;

    const pnpmSyncJsonPath1 = `${pnpmSyncJsonFolder1}/.pnpm-sync.json`;
    const pnpmSyncJsonPath2 = `${pnpmSyncJsonFolder2}/.pnpm-sync.json`;

    // if .pnpm-sync.json already exists, delete it first
    if (fs.existsSync(pnpmSyncJsonPath1)) {
      fs.unlinkSync(pnpmSyncJsonPath1);
    }

    if (fs.existsSync(pnpmSyncJsonPath2)) {
      fs.unlinkSync(pnpmSyncJsonPath2);
    }

    // generate .pnpm-sync.json file first.
    await pnpmSyncPrepareAsync({
      lockfilePath: lockfilePath,
      dotPnpmFolder: dotPnpmFolder,
      ensureFolderAsync: FileSystem.ensureFolderAsync,
      readPnpmLockfile,
      logMessageCallback: (): void => {}
    });

    const targetFolderPath1 =
      '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib1_react@17.0.2/node_modules/@tiktok-arch/api-demo-sample-lib1';
    const targetFolderPath2 =
      '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib2_react@17.0.2/node_modules/@tiktok-arch/api-demo-sample-lib2';

    // make sure .pnpm-sync.json exists
    expect(fs.existsSync(pnpmSyncJsonPath1)).toBe(true);
    expect(fs.existsSync(pnpmSyncJsonPath2)).toBe(true);

    expect(JSON.parse(fs.readFileSync(pnpmSyncJsonPath1).toString())).toEqual({
      version: pnpmSyncLibVersion,
      postbuildInjectedCopy: {
        sourceFolder: '..',
        targetFolders: [
          {
            folderPath: targetFolderPath1
          }
        ]
      }
    });
    expect(JSON.parse(fs.readFileSync(pnpmSyncJsonPath2).toString())).toEqual({
      version: pnpmSyncLibVersion,
      postbuildInjectedCopy: {
        sourceFolder: '..',
        targetFolders: [
          {
            folderPath: targetFolderPath2
          }
        ]
      }
    });
  });

  it('pnpmSyncCopyAsync should copy files based on .pnpm-sync.json under node_modules folder', async () => {
    const pnpmSyncJsonFolder = `../test-fixtures/sample-lib1/node_modules`;
    const pnpmSyncJsonPath = `${pnpmSyncJsonFolder}/.pnpm-sync.json`;

    const targetFolderPath =
      '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib1_react@17.0.2/node_modules/@tiktok-arch/api-demo-sample-lib1';
    const pnpmSyncJsonFile = JSON.parse(fs.readFileSync(pnpmSyncJsonPath).toString());

    // set a outdated version
    pnpmSyncJsonFile.version = 'incompatible-version';
    await fs.promises.writeFile(pnpmSyncJsonPath, JSON.stringify(pnpmSyncJsonFile, null, 2));

    // if pnpmSyncCopyAsync detects a incompatible version, should throw errors
    try {
      await pnpmSyncCopyAsync({
        pnpmSyncJsonPath,
        getPackageIncludedFiles: PackageExtractor.getPackageIncludedFilesAsync,
        forEachAsyncWithConcurrency: Async.forEachAsync,
        ensureFolderAsync: FileSystem.ensureFolderAsync,
        logMessageCallback: () => {}
      });
    } catch (error) {
      expect(error.message).toContain('has an incompatible version; regenerate it and try again');
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
      ensureFolderAsync: FileSystem.ensureFolderAsync,
      logMessageCallback: (options: ILogMessageCallbackOptions): void => {
        logs.push(options);
      }
    });

    // after copy action, the destination folder should exists
    expect(fs.existsSync(destinationPath)).toBe(true);

    // and the real files should be there
    expect(fs.existsSync(path.join(destinationPath, 'src/index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(destinationPath, 'dist/index.js'))).toBe(true);

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

  it('pnpmSyncCopyAsync should handle incremental copy', async () => {
    const pnpmSyncJsonFolder = `../test-fixtures/sample-lib2/node_modules`;
    const pnpmSyncJsonPath = `${pnpmSyncJsonFolder}/.pnpm-sync.json`;

    const targetFolderPath =
      '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib2_react@17.0.2/node_modules/@tiktok-arch/api-demo-sample-lib2';

    const destinationPath = path.resolve(pnpmSyncJsonFolder, targetFolderPath);
    const sourcePath = '../test-fixtures/sample-lib2';

    // let's do copy action first
    await pnpmSyncCopyAsync({
      pnpmSyncJsonPath,
      getPackageIncludedFiles: PackageExtractor.getPackageIncludedFilesAsync,
      forEachAsyncWithConcurrency: Async.forEachAsync,
      ensureFolderAsync: FileSystem.ensureFolderAsync,
      logMessageCallback: (): void => {}
    });

    // after copy action, the destination folder should exists
    expect(fs.existsSync(destinationPath)).toBe(true);

    const destinationPackageJsonPath = path.join(destinationPath, 'package.json');
    const destinationIndexFilePath = path.join(destinationPath, 'dist/index.js');

    // and the files should be there
    expect(fs.existsSync(destinationPackageJsonPath)).toBe(true);
    expect(fs.existsSync(destinationIndexFilePath)).toBe(true);

    // let get the file info of package.json in destination folder
    const oldDestinationPackageJsonStat = fs.statSync(destinationPackageJsonPath);

    // now let's do some file operations in source folder
    // create a new file
    fs.writeFileSync(path.join(sourcePath, 'dist/index.new.js'), 'console.log("Hello World!")');
    // delete a old file
    fs.rmSync(path.join(sourcePath, 'dist/index.js'));
    // modify an existing file
    const sourcePackageJsonPath = path.join(sourcePath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(sourcePackageJsonPath).toString());
    const newPackageJsonDescription = 'Test description value';
    packageJson.description = newPackageJsonDescription;
    fs.writeFileSync(sourcePackageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

    // let get the file info of modified package.json in source folder
    const sourcePackageJsonStat = fs.statSync(sourcePackageJsonPath);

    // now let's run pnpmSyncCopyAsync again
    await pnpmSyncCopyAsync({
      pnpmSyncJsonPath,
      getPackageIncludedFiles: PackageExtractor.getPackageIncludedFilesAsync,
      forEachAsyncWithConcurrency: Async.forEachAsync,
      ensureFolderAsync: FileSystem.ensureFolderAsync,
      logMessageCallback: (): void => {}
    });

    // ok, now, let's do some verification
    // 1. for file edit operation
    // let's read the file info of package.json in destination folder again
    const newDestinationPackageJsonStat = fs.statSync(destinationPackageJsonPath);
    // Since it is a hard link, the file inode number should not be changed, still the original inode number!
    expect(sourcePackageJsonStat.ino).toBe(newDestinationPackageJsonStat.ino);
    expect(sourcePackageJsonStat.ino).toBe(oldDestinationPackageJsonStat.ino);
    // and, the actual content in destination folder should be the new value
    expect(JSON.parse(fs.readFileSync(destinationPackageJsonPath).toString()).description).toBe(
      newPackageJsonDescription
    );

    // 2. the deleted file should not exist
    expect(fs.existsSync(destinationIndexFilePath)).toBe(false);

    // 3. then new added file should be there
    expect(fs.existsSync(path.join(destinationPath, 'dist/index.new.js'))).toBe(true);
  });

  it('pnpmSyncCopyAsync should not delete node_modules folder in .pnpm folder', async () => {
    const pnpmSyncJsonFolder = `../test-fixtures/sample-lib2/node_modules`;
    const pnpmSyncJsonPath = `${pnpmSyncJsonFolder}/.pnpm-sync.json`;

    const targetFolderPath =
      '../../../../node_modules/.pnpm/file+tests+test-fixtures+sample-lib2_react@17.0.2/node_modules/@tiktok-arch/api-demo-sample-lib2';

    const destinationPath = path.resolve(pnpmSyncJsonFolder, targetFolderPath);

    // let fake a node_modules and add some files
    // create node_modules folder
    fs.mkdirSync(path.join(destinationPath, 'node_modules'));
    // create .bin folder
    fs.mkdirSync(path.join(destinationPath, 'node_modules/.bin'));
    // create a test file
    const testBinFileInDestinationPath: string = path.join(destinationPath, 'node_modules/.bin/test.js');
    fs.writeFileSync(testBinFileInDestinationPath, 'console.log("Hello World in .bin!")');

    // let's do copy action first
    await pnpmSyncCopyAsync({
      pnpmSyncJsonPath,
      getPackageIncludedFiles: PackageExtractor.getPackageIncludedFilesAsync,
      forEachAsyncWithConcurrency: Async.forEachAsync,
      ensureFolderAsync: FileSystem.ensureFolderAsync,
      logMessageCallback: (): void => {}
    });

    // after copy action, the destination folder should exists
    expect(fs.existsSync(destinationPath)).toBe(true);

    // and the test file should be there
    expect(fs.existsSync(testBinFileInDestinationPath)).toBe(true);
  });
});
