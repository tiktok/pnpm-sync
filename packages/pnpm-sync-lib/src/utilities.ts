import fs from 'fs';
import path from 'path';
import { IFileStat } from './interfaces';

/**
 * Get .pnpm-sync.json version
 *
 * @beta
 */
export function pnpmSyncGetJsonVersion(): string {
  return require('../package.json').version;
}

export function getFilesInDirectory(directory: string, includeDirectory: boolean): Array<IFileStat> {
  const returnFileList: Array<IFileStat> = [];
  getFilesInDirectoryHelper(directory, includeDirectory, returnFileList);
  return returnFileList;
}

function getFilesInDirectoryHelper(
  directory: string,
  includeDirectory: boolean,
  returnFileList: Array<IFileStat>
): void {
  const fileList = fs.readdirSync(directory);

  for (const fileName of fileList) {
    const absoluteFileName: string = path.join(directory, fileName);
    const fileStat = fs.statSync(absoluteFileName);
    if (fileStat.isDirectory()) {
      if (includeDirectory) {
        returnFileList.push({
          file: absoluteFileName,
          ino: fileStat.ino,
          isDirectory: true,
          isFile: false
        });
      }
      getFilesInDirectoryHelper(absoluteFileName, includeDirectory, returnFileList);
    } else {
      returnFileList.push({
        file: absoluteFileName,
        ino: fileStat.ino,
        isDirectory: false,
        isFile: true
      });
    }
  }
}
