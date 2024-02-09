import { Command } from 'commander';
import { pnpmSyncCopy, pnpmSyncPrepare } from 'pnpm-sync-lib';

const program:Command = new Command();

program.version(require('../package.json').version);

program.command('copy')
  .description('Execute the copy action based on the plan defined under node_modules/.pnpm-sync.json')
  .action(pnpmSyncCopy);

program.command('prepare')
  .description('Generate the pnpm-sync.json based on pnpm-lock.yaml file path and .pnpm folder path')
  .requiredOption('-l, --lockfile <value>', 'The pnpm-lock.yaml file path')
  .requiredOption('-s, --store <value>', 'The .pnpm folder path')
  .action(async options => {
    const { lockfile, store } = options;
    try {
      await pnpmSyncPrepare(lockfile, store);
    } catch (error) {
      console.log(error);
    }
    
  });

program.parse();
