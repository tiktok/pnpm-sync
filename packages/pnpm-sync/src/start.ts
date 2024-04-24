import { Command } from 'commander';
import {
  type ILockfile,
  type ILockfilePackage,
  pnpmSyncCopyAsync,
  pnpmSyncPrepareAsync,
  type ILogMessageCallbackOptions
} from 'pnpm-sync-lib';
import { FileSystem, Async } from '@rushstack/node-core-library';
import { PackageExtractor } from '@rushstack/package-extractor';
import { readWantedLockfile, Lockfile } from '@pnpm/lockfile-file';

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
        logMessageCallback: logMessage
      });
    } catch (error) {
      console.log('UNEXPECTED ERROR: ' + error);
      process.exitCode = 1;
    }
  });

program.parse();
