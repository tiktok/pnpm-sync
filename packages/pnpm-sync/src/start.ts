import { Command } from 'commander';
import { pnpmSyncCopyAsync, pnpmSyncPrepareAsync, type ILogMessageCallbackOptions } from 'pnpm-sync-lib';
import { FileSystem, Async } from '@rushstack/node-core-library';
import { PackageExtractor } from '@rushstack/package-extractor';
import { readWantedLockfile as readWantedLockfileV6 } from '@pnpm/lockfile-file-pnpm-lock-v6';
import { readWantedLockfile as readWantedLockfileV9 } from '@pnpm/lockfile.fs-pnpm-lock-v9';

const program: Command = new Command();

program.version(require('../package.json').version);

let verboseLogging: boolean = false;
function logMessage(options: ILogMessageCallbackOptions): void {
  const { message, messageKind } = options;

  switch (messageKind) {
    case 'error':
      console.error('ERROR: ' + message);
      process.exitCode = 1;
      break;
    case 'warning':
      console.error('WARNING: ' + message);
      process.exitCode = 1;
      break;
    case 'verbose':
      if (verboseLogging) {
        console.log(message);
      }
      break;
    default:
      console.log(message);
      break;
  }
}

program
  .command('copy')
  .description('Execute the copy action based on the plan defined under node_modules/.pnpm-sync.json')
  .option('-v, --verbose', 'Show verbose messages')
  .action(async (options) => {
    try {
      const { verbose } = options;
      verboseLogging = verbose;

      await pnpmSyncCopyAsync({
        pnpmSyncJsonPath: process.cwd() + '/node_modules/.pnpm-sync.json',
        getPackageIncludedFiles: PackageExtractor.getPackageIncludedFilesAsync,
        forEachAsyncWithConcurrency: Async.forEachAsync,
        ensureFolderAsync: FileSystem.ensureFolderAsync,
        logMessageCallback: logMessage
      });
    } catch (error) {
      console.log('UNEXPECTED ERROR: ' + error);
      process.exitCode = 1;
    }
  });

program
  .command('prepare')
  .description('Regenerate the .pnpm-sync.json file for a given pnpm-lock.yaml lockfile')
  .requiredOption('-l, --lockfile <value>', 'The pnpm-lock.yaml file path')
  .requiredOption('-s, --store <value>', 'The PNPM virtual store path ("node_modules/.pnpm" folder)')
  .option('-v, --verbose', 'Show verbose messages')
  .action(async (options) => {
    try {
      const { lockfile, store, verbose } = options;
      verboseLogging = verbose;

      await pnpmSyncPrepareAsync({
        lockfilePath: lockfile,
        dotPnpmFolder: store,
        ensureFolderAsync: FileSystem.ensureFolderAsync,
        readPnpmLockfile: async (
          lockfilePath: string,
          options: {
            ignoreIncompatible: boolean;
          }
        ) => {
          const pnpmLockFolder = lockfilePath.slice(0, lockfilePath.length - 'pnpm-lock.yaml'.length);

          const lockfileV6 = await readWantedLockfileV6(pnpmLockFolder, options);

          if (lockfileV6?.lockfileVersion.toString().startsWith('6')) {
            return lockfileV6;
          }

          const lockfileV9 = await readWantedLockfileV9(pnpmLockFolder, options);

          if (lockfileV9?.lockfileVersion.toString().startsWith('9')) {
            return lockfileV9;
          }

          return undefined;
        },
        logMessageCallback: logMessage
      });
    } catch (error) {
      console.log('UNEXPECTED ERROR: ' + error);
      process.exitCode = 1;
    }
  });

program.parse();
