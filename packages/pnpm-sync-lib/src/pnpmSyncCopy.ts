import path from 'path';
import fs from 'fs';
import { hrtime } from 'node:process';
import { ILogMessageKind } from './interfaces';

/**
 * @beta
 */
export interface IPnpmSyncCopyOptions {
  pnpmSyncJsonPath?: string;
  getPackageIncludedFiles: (packagePath: string) => Promise<string[]>;
  forEachAsyncWithConcurrency: <TItem>(
    iterable: Iterable<TItem>,
    callback: (item: TItem) => Promise<void>,
    options: { concurrency: number }
  ) => Promise<void>;
  ensureFolder: (folderPath: string) => Promise<void>;
  logMessageCallback: (
    message: string,
    messageKind: ILogMessageKind,
    details?: {
      fileCount: number;
      executionTimeInMs: string;
    }
  ) => void;
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
 * @param pnpmSyncJsonPath - optionally customizes the location of the `.pnpm-sync.json` file
 *
 * @beta
 */
export async function pnpmSyncCopyAsync({
  pnpmSyncJsonPath = '',
  getPackageIncludedFiles,
  forEachAsyncWithConcurrency,
  ensureFolder,
  logMessageCallback
}: IPnpmSyncCopyOptions): Promise<void> {
  if (pnpmSyncJsonPath === '') {
    // if user does not input .pnpm-sync.json file path
    // then we assume .pnpm-sync.json is always under node_modules folder
    pnpmSyncJsonPath = 'node_modules/.pnpm-sync.json';
  }

  let pnpmSyncJsonContents: string;
  try {
    pnpmSyncJsonContents = (await fs.promises.readFile(pnpmSyncJsonPath)).toString();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      const errorMessage: string =
        'You are executing pnpm-sync for a package, but we can not find the .pnpm-sync.json inside node_modules folder';
      logMessageCallback(errorMessage, ILogMessageKind.ERROR);
      return;
    } else {
      throw e;
    }
  }

  //read the .pnpm-sync.json
  const pnpmSyncJson = JSON.parse(pnpmSyncJsonContents);
  const { sourceFolder, targetFolders } = pnpmSyncJson.postbuildInjectedCopy;
  const sourcePath = path.resolve(pnpmSyncJsonPath, sourceFolder);

  //get npmPackFiles
  const npmPackFiles: string[] = await getPackageIncludedFiles(sourcePath);

  const startTime = hrtime.bigint();

  //clear the destination folder first
  for (const targetFolder of targetFolders) {
    const destinationPath = path.resolve(pnpmSyncJsonPath, targetFolder.folderPath);
    await fs.promises.rm(destinationPath, { recursive: true, force: true });
  }

  await forEachAsyncWithConcurrency(
    npmPackFiles,
    async (npmPackFile: string) => {
      for (const targetFolder of targetFolders) {
        const destinationPath = path.resolve(pnpmSyncJsonPath, targetFolder.folderPath);

        const copySourcePath: string = path.join(sourcePath, npmPackFile);
        const copyDestinationPath: string = path.join(destinationPath, npmPackFile);

        await ensureFolder(path.dirname(copyDestinationPath));

        // create a hard link to the destination path
        await fs.promises.link(copySourcePath, copyDestinationPath);
      }
    },
    {
      concurrency: 10
    }
  );

  const endTime = hrtime.bigint();
  const copyExecutionTimeInMs: string = (Number(endTime - startTime) / 1e6).toFixed(3) + 'ms';
  const infoMessage = `pnpm-sync copy: Copied ${npmPackFiles.length} files in ${copyExecutionTimeInMs} from ${sourcePath}`;
  logMessageCallback(infoMessage, ILogMessageKind.INFO, {
    fileCount: npmPackFiles.length,
    executionTimeInMs: copyExecutionTimeInMs
  });
}
