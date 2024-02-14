import { Command } from "commander";
import { pnpmSyncCopyAsync, pnpmSyncPrepareAsync } from "pnpm-sync-lib";
import { FileSystem, Async } from "@rushstack/node-core-library";
import { PackageExtractor } from "@rushstack/package-extractor";
import { readWantedLockfile } from "@pnpm/lockfile-file";

const program: Command = new Command();

program.version(require("../package.json").version);

program
  .command("copy")
  .description(
    "Execute the copy action based on the plan defined under node_modules/.pnpm-sync.json"
  )
  .action(
    async () =>
      await pnpmSyncCopyAsync({
        getPackageIncludedFiles: PackageExtractor.getPackageIncludedFilesAsync,
        forEachAsyncWithConcurrency: Async.forEachAsync,
        ensureFolder: FileSystem.ensureFolderAsync,
      })
  );

program
  .command("prepare")
  .description(
    "Generate the pnpm-sync.json based on pnpm-lock.yaml file path and .pnpm folder path"
  )
  .requiredOption("-l, --lockfile <value>", "The pnpm-lock.yaml file path")
  .requiredOption("-s, --store <value>", "The .pnpm folder path")
  .action(async (options) => {
    const { lockfile, store } = options;
    try {
      await pnpmSyncPrepareAsync({
        lockfilePath: lockfile,
        storePath: store,
        readWantedLockfile,
      });
    } catch (error) {
      console.log(error);
    }
  });

program.parse();
