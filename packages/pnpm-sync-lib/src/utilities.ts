import fs, { type Dirent } from 'fs';
import path from 'path';
import { ISyncItem } from './interfaces';

/**
 * Get .pnpm-sync.json version
 *
 * @beta
 */
export function pnpmSyncGetJsonVersion(): string {
  return require('../package.json').version;
}

export async function getFilesInDirectory(directory: string): Promise<ISyncItem[]> {
  const returnFileList: ISyncItem[] = [];
  await getFilesInDirectoryHelper(directory, returnFileList);
  return returnFileList;
}

async function getFilesInDirectoryHelper(directory: string, returnFileList: ISyncItem[]): Promise<void> {
  const itemList: Array<Dirent> = await fs.promises.readdir(directory, { withFileTypes: true });

  for (const item of itemList) {
    const absolutePath: string = path.join(directory, item.name);
    // when PNPM install injected dependencies
    // it will create necessary node_modules/.bin folder in PNPM store
    // so we need to ignore node_modules folder in the pnpm-store location
    if (item.isDirectory() && item.name !== 'node_modules') {
      await getFilesInDirectoryHelper(absolutePath, returnFileList);
    }

    // the list should include both files and directories
    returnFileList.push({
      absolutePath,
      isDirectory: item.isDirectory(),
      isFile: item.isFile()
    });
  }
}
