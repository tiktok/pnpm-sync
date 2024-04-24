import path from 'path';
import fs from 'fs';
import process from 'node:process';
import {
  ILogMessageCallbackOptions,
  IPnpmSyncJson,
  ISyncItem,
  LogMessageIdentifier,
  LogMessageKind
} from './interfaces';
import { getFilesInDirectory, pnpmSyncGetJsonVersion } from './utilities';

/**
 * @beta
 */
export interface IPnpmSyncCopyOptions {
  /**
   * Path to the `<project-folder>/node_modules/.pnpm-sync.json` file to be processed.
   * This parameter is required because the caller should efficiently test its existence
   * and can avoid invoking pnpmSync if it is absent.
   */
  pnpmSyncJsonPath: string;

  /**
   * Environment-provided API to avoid an NPM dependency.
   * The "pnpm-sync" NPM package provides a reference implementation.
   */
  getPackageIncludedFiles: (packagePath: string) => Promise<string[]>;

  /**
   * Environment-provided API to avoid an NPM dependency.
   * The "pnpm-sync" NPM package provides a reference implementation.
   */
  forEachAsyncWithConcurrency: <TItem>(
    iterable: Iterable<TItem>,
    callback: (item: TItem) => Promise<void>,
    options: { concurrency: number }
  ) => Promise<void>;

  /**
   * Environment-provided API to avoid an NPM dependency.
   * The "pnpm-sync" NPM package provides a reference implementation.
   */
  ensureFolderAsync: (folderPath: string) => Promise<void>;
  /**
   * A callback for reporting events during the operation.
   *
   * @remarks
   * `LogMessageKind.ERROR` events do NOT cause the promise to reject,
   * so they must be handled appropriately.
   */
  logMessageCallback: (options: ILogMessageCallbackOptions) => void;
}

/**
 * For each library project that acts as an injected dependency of other consuming projects
 * within a PNPM workspace, this operation should be invoked whenever that library is rebuilt.
 * It will copy the latest build output into the `node_modules` installation folder.
 *
 * @remarks
 * This operation reads the `.npm-sync.json` file which should have been prepared after
 * `pnpm install` by calling the {@link pnpmSyncPrepareAsync} function.
 *
 * @beta
 */
export async function pnpmSyncCopyAsync(options: IPnpmSyncCopyOptions): Promise<void> {
  const { getPackageIncludedFiles, forEachAsyncWithConcurrency, ensureFolderAsync, logMessageCallback } =
    options;
  let pnpmSyncJsonPath = options.pnpmSyncJsonPath;

  pnpmSyncJsonPath = path.resolve(process.cwd(), pnpmSyncJsonPath);

  logMessageCallback({
    message: `Starting operation for ` + pnpmSyncJsonPath,
    messageKind: LogMessageKind.VERBOSE,
    details: {
      messageIdentifier: LogMessageIdentifier.COPY_STARTING,
      pnpmSyncJsonPath
    }
  });

  let pnpmSyncJsonContents: string;
  try {
    pnpmSyncJsonContents = (await fs.promises.readFile(pnpmSyncJsonPath)).toString();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      logMessageCallback({
        message:
          'The .pnpm-sync.json file was not found under the node_modules folder; was this project prepared?',
        messageKind: LogMessageKind.ERROR,
        details: {
          messageIdentifier: LogMessageIdentifier.COPY_ERROR_NO_SYNC_FILE,
          pnpmSyncJsonPath
        }
      });
      return;
    } else {
      throw e;
    }
  }

  const pnpmSyncJsonFolder = path.dirname(pnpmSyncJsonPath);

  // read the .pnpm-sync.json
  const pnpmSyncJson: IPnpmSyncJson = JSON.parse(pnpmSyncJsonContents);

  // verify if the version is incompatible
  const expectedPnpmSyncJsonVersion: string = pnpmSyncGetJsonVersion();
  const actualPnpmSyncJsonVersion: string = pnpmSyncJson.version;
  if (expectedPnpmSyncJsonVersion !== actualPnpmSyncJsonVersion) {
    const errorMessage = `The .pnpm-sync.json file in ${pnpmSyncJsonFolder} has an incompatible version; regenerate it and try again.`;
    logMessageCallback({
      message: errorMessage,
      messageKind: LogMessageKind.ERROR,
      details: {
        messageIdentifier: LogMessageIdentifier.COPY_ERROR_INCOMPATIBLE_SYNC_FILE,
        pnpmSyncJsonPath,
        actualVersion: actualPnpmSyncJsonVersion,
        expectedVersion: expectedPnpmSyncJsonVersion
      }
    });
    throw Error(errorMessage);
  }

  const { sourceFolder, targetFolders } = pnpmSyncJson.postbuildInjectedCopy;
  const sourcePath = path.resolve(pnpmSyncJsonFolder, sourceFolder);

  // get npmPackFiles
  const npmPackFiles: string[] = await getPackageIncludedFiles(sourcePath);

  const startTime = process.hrtime.bigint();

  // init the map to track files that already processed
  const targetFolderFileToIsProcessed: Map<string, ISyncItem> = new Map();

  for (const targetFolder of targetFolders) {
    const destinationPath = path.resolve(pnpmSyncJsonFolder, targetFolder.folderPath);
    if (!fs.existsSync(destinationPath)) {
      continue;
    }
    const existFileStatInoInTargetFolder: Array<ISyncItem> = await getFilesInDirectory(destinationPath);
    // all files are not processed in the beginning
    for (const item of existFileStatInoInTargetFolder) {
      targetFolderFileToIsProcessed.set(item.absolutePath, item);
    }
  }

  await forEachAsyncWithConcurrency(
    npmPackFiles,
    async (npmPackFile: string) => {
      for (const targetFolder of targetFolders) {
        const destinationPath = path.resolve(pnpmSyncJsonFolder, targetFolder.folderPath);

        const copySourcePath: string = path.join(sourcePath, npmPackFile);
        const copyDestinationPath: string = path.join(destinationPath, npmPackFile);

        if (!targetFolderFileToIsProcessed.has(copyDestinationPath)) {
          // if not exist in target folder, we just copy it
          await ensureFolderAsync(path.dirname(copyDestinationPath));
          await fs.promises.link(copySourcePath, copyDestinationPath);
        } else {
          // if exist in target folder, check if it still point to the source Inode number
          // in our copy implementation, we use hard link to copy files
          // so that, we can utilize the file inode info to determine the equality of two files
          const sourceFileIno = (await fs.promises.stat(copySourcePath)).ino;
          const destinationFileIno = (await fs.promises.stat(copyDestinationPath)).ino;
          if (sourceFileIno !== destinationFileIno) {
            await fs.promises.unlink(copyDestinationPath);
            await fs.promises.link(copySourcePath, copyDestinationPath);
          }

          // to keep track which file already processed
          targetFolderFileToIsProcessed.delete(copyDestinationPath);
        }
      }
    },
    {
      concurrency: 10
    }
  );

  // delete unprocessed files in target folders
  const unprocessedDirectories: string[] = [];
  for (const [absolutePath, item] of targetFolderFileToIsProcessed) {
    if (item.isFile) {
      await fs.promises.unlink(absolutePath);
    } else {
      unprocessedDirectories.push(absolutePath);
    }
  }

  // delete empty folders in target folders as well
  for (const directory of unprocessedDirectories) {
    if ((await fs.promises.readdir(directory)).length === 0) {
      await fs.promises.rmdir(directory);
    }
  }

  const endTime = process.hrtime.bigint();
  const executionTimeInMs: number = Number(endTime - startTime) / 1e6;

  const infoMessage =
    `Synced ${npmPackFiles.length} ` +
    (npmPackFiles.length === 1 ? 'file' : 'files') +
    ` in ${executionTimeInMs.toFixed(3)} ms from ${sourcePath}`;

  logMessageCallback({
    message: infoMessage,
    messageKind: LogMessageKind.INFO,
    details: {
      messageIdentifier: LogMessageIdentifier.COPY_FINISHING,
      pnpmSyncJsonPath,
      fileCount: npmPackFiles.length,
      sourcePath,
      executionTimeInMs
    }
  });
}
