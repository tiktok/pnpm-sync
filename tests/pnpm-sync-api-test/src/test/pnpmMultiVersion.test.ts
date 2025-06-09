import path from 'node:path';
import { execa } from 'execa';
import { FileSystem } from '@rushstack/node-core-library';
import { ILogMessageCallbackOptions, pnpmSyncPrepareAsync } from 'pnpm-sync-lib';
import { __dirname, readPnpmLockfile, scrubLog } from './testUtilities.js';

describe('pnpm multi version test', () => {
  it.each(['8', '9', '10'])('pnpm v%s', async (version) => {
    const logs: ILogMessageCallbackOptions[] = [];
    const projectDir = path.join(__dirname, '..', '..', '..', 'test-fixtures', `pnpm-v${version}`);

    // Clean the project directory by removing all untracked files and directories
    await execa({ cwd: projectDir })`git clean -xdf`;
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
    expect(() => {
      for (const targetFolder of pnpmSyncJSON.postbuildInjectedCopy.targetFolders) {
        FileSystem.exists(targetFolder.folderPath);
      }
    }).not.toThrow();
  });
});
