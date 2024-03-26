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

program
  .command('copy')
  .description('Execute the copy action based on the plan defined under node_modules/.pnpm-sync.json')
  .action(
    async () =>
      await pnpmSyncCopyAsync({
        getPackageIncludedFiles: PackageExtractor.getPackageIncludedFilesAsync,
        forEachAsyncWithConcurrency: Async.forEachAsync,
        ensureFolder: FileSystem.ensureFolderAsync,
        logMessageCallback: (options: ILogMessageCallbackOptions) => {
          const { message, messageKind } = options;
          switch (messageKind) {
            case 'error':
              console.error(message);
              break;
            case 'warning':
              console.warn(message);
              break;
            default:
              console.log(message);
              break;
          }
        }
      })
  );

program
  .command('prepare')
  .description('Generate the pnpm-sync.json based on pnpm-lock.yaml file path and .pnpm folder path')
  .requiredOption('-l, --lockfile <value>', 'The pnpm-lock.yaml file path')
  .requiredOption('-s, --store <value>', 'The .pnpm folder path')
  .action(async (options) => {
    const { lockfile, store } = options;
    try {
      await pnpmSyncPrepareAsync({
        lockfilePath: lockfile,
        storePath: store,
        ensureFolder: FileSystem.ensureFolderAsync,
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
        logMessageCallback: (options: ILogMessageCallbackOptions) => {
          const { message, messageKind } = options;
          switch (messageKind) {
            case 'error':
              console.error(message);
              break;
            case 'warning':
              console.warn(message);
              break;
            default:
              console.log(message);
              break;
          }
        }
      });
    } catch (error) {
      console.log(error);
    }
  });

program.parse();
