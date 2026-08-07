import path from 'node:path';
import { execa } from 'execa';
import { FileSystem } from '@rushstack/node-core-library';
import { ILogMessageCallbackOptions, pnpmSyncPrepareAsync } from 'pnpm-sync-lib';
import { __dirname, readPnpmLockfile, scrubLog } from './testUtilities.js';

describe('pnpm multi version test', () => {
  it.each(['8', '9', '10', '11'])(
    'pnpm v%s',
    async (version) => {
      const logs: ILogMessageCallbackOptions[] = [];
      const projectDir = path.join(__dirname, '..', '..', '..', 'test-fixtures', `pnpm-v${version}`);

      // Remove install outputs without requiring the fixture itself to already be tracked by Git.
      await Promise.all(
        [
          path.join(projectDir, 'node_modules'),
          path.join(projectDir, 'apps', 'sample-app1', 'node_modules'),
          path.join(projectDir, 'apps', 'sample-app2', 'node_modules'),
          path.join(projectDir, 'packages', 'sample-lib1', 'node_modules')
        ].map((folderPath) => FileSystem.deleteFolderAsync(folderPath))
      );
      // Install dependencies using the specified pnpm version via corepack
      await execa({ cwd: projectDir })`corepack pnpm i`;

      await pnpmSyncPrepareAsync({
        lockfilePath: path.join(projectDir, 'pnpm-lock.yaml'),
        dotPnpmFolder: path.join(projectDir, 'node_modules', '.pnpm'),
        ensureFolderAsync: FileSystem.ensureFolderAsync,
        readPnpmLockfile,
        logMessageCallback: (options: ILogMessageCallbackOptions): void => {
          logs.push(options);
        }
      });

      expect(logs.map((x) => scrubLog(x))).toMatchSnapshot();

      const pnpmSyncJSONFile = path.join(
        projectDir,
        'packages',
        'sample-lib1',
        'node_modules',
        '.pnpm-sync.json'
      );
      const pnpmSyncJSON = JSON.parse(FileSystem.readFile(pnpmSyncJSONFile));

      // Verify that the configuration matches the expected snapshot
      expect(pnpmSyncJSON).toMatchSnapshot();

      // Verify that all target folders specified in the configuration exist
      for (const targetFolder of pnpmSyncJSON.postbuildInjectedCopy.targetFolders) {
        const targetFolderPath = path.resolve(path.dirname(pnpmSyncJSONFile), targetFolder.folderPath);
        expect(FileSystem.exists(targetFolderPath)).toBe(true);
      }
    },
    120_000
  );
});
