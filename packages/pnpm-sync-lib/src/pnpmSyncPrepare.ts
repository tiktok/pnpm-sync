import path from 'path';
import fs from 'fs';
import YAML from 'yaml';
import process from 'node:process';
import { depPathToFilename } from '@pnpm/dependency-path';

import {
  ILockfile,
  ILogMessageCallbackOptions,
  LogMessageKind,
  LogMessageIdentifier,
  IPnpmSyncJson,
  IVersionSpecifier,
  ILockfilePackage
} from './interfaces';
import { pnpmSyncGetJsonVersion } from './utilities';

/**
 * @beta
 */
export interface IPnpmSyncPrepareOptions {
  /**
   * The path to the `pnpm-lock.yaml` file
   */
  lockfilePath: string;

  /**
   * The path to the PNPM virtual store ("node_modules/.pnpm" folder)
   */
  dotPnpmFolder: string;

  /**
   * Environment-provided API to avoid an NPM dependency.
   * The "pnpm-sync" NPM package provides a reference implementation.
   */
  ensureFolderAsync: (folderPath: string) => Promise<void>;

  /**
   * Environment-provided API to avoid an NPM dependency.
   * The "pnpm-sync" NPM package provides a reference implementation.
   */
  readPnpmLockfile: (
    lockfilePath: string,
    options: { ignoreIncompatible: boolean }
  ) => Promise<ILockfile | undefined>;

  /**
   * A callback for reporting events during the operation.
   *
   * @remarks
   * `LogMessageKind.ERROR` events do NOT cause the promise to reject,
   * so they must be handled appropriately.
   */
  logMessageCallback: (options: ILogMessageCallbackOptions) => void;
}

/**
 * For each workspace project has injected dependencies in a PNPM workspace, this API
 * should be invoked to prepare its `.pnpm-sync.json` file.  While building projects,
 * that file will be used by {@link pnpmSyncCopyAsync} to recopy the build outputs into
 * injected dependency installation folders under the `node_modules` folder.
 *
 * @beta
 */
export async function pnpmSyncPrepareAsync(options: IPnpmSyncPrepareOptions): Promise<void> {
  const { ensureFolderAsync, readPnpmLockfile, logMessageCallback } = options;
  let { lockfilePath, dotPnpmFolder } = options;

  // get the pnpm-lock.yaml path
  lockfilePath = path.resolve(process.cwd(), lockfilePath);
  dotPnpmFolder = path.resolve(process.cwd(), dotPnpmFolder);

  logMessageCallback({
    message:
      `Starting operation...\n` +
      `pnpm-lock.yaml file path: ${lockfilePath}\n` +
      `.pnpm folder path: ${dotPnpmFolder}`,
    messageKind: LogMessageKind.VERBOSE,
    details: {
      messageIdentifier: LogMessageIdentifier.PREPARE_STARTING,
      lockfilePath,
      dotPnpmFolder
    }
  });

  if (!fs.existsSync(lockfilePath) || !fs.existsSync(dotPnpmFolder)) {
    throw Error('The input pnpm-lock.yaml path or the input .pnpm folder path is not correct!');
  }

  const startTime = process.hrtime.bigint();

  const pnpmModulesYamlPath: string = path.resolve(dotPnpmFolder, '..');
  const pnpmModulesYaml = YAML.parse(fs.readFileSync(`${pnpmModulesYamlPath}/.modules.yaml`, 'utf8'));
  const pnpmVersion: string | undefined = pnpmModulesYaml?.packageManager?.split('@')[1];

  // currently, only support pnpm v8
  if (!pnpmVersion || !pnpmVersion.startsWith('8')) {
    logMessageCallback({
      message: `The pnpm version is not supported; pnpm-sync requires pnpm version 8.x`,
      messageKind: LogMessageKind.ERROR,
      details: {
        messageIdentifier: LogMessageIdentifier.PREPARE_ERROR_UNSUPPORTED_PNPM_VERSION,
        lockfilePath,
        pnpmVersion: pnpmVersion
      }
    });
    return;
  }

  // read the pnpm-lock.yaml
  const pnpmLockfile: ILockfile | undefined = await readPnpmLockfile(lockfilePath, {
    ignoreIncompatible: true
  });

  // currently, only support lockfileVersion 6.x, which is pnpm v8
  const lockfileVersion: string | undefined = pnpmLockfile?.lockfileVersion.toString();
  if (!lockfileVersion || !lockfileVersion.startsWith('6')) {
    logMessageCallback({
      message: `The pnpm-lock.yaml format is not supported; pnpm-sync requires lockfile version 6`,
      messageKind: LogMessageKind.ERROR,
      details: {
        messageIdentifier: LogMessageIdentifier.PREPARE_ERROR_UNSUPPORTED_FORMAT,
        lockfilePath,
        lockfileVersion
      }
    });
    return;
  }

  // find injected dependency and all its available versions
  const injectedDependencyToVersion: Map<string, Set<string>> = new Map();
  for (const importerItem of Object.values(pnpmLockfile?.importers || {})) {
    // based on https://pnpm.io/package_json#dependenciesmeta
    // the injected dependencies could available inside dependencies, optionalDependencies, and devDependencies.
    getInjectedDependencyToVersion(importerItem?.dependencies, injectedDependencyToVersion);
    getInjectedDependencyToVersion(importerItem?.devDependencies, injectedDependencyToVersion);
    getInjectedDependencyToVersion(importerItem?.optionalDependencies, injectedDependencyToVersion);
  }

  // check and process transitive injected dependency
  processTransitiveInjectedDependency(pnpmLockfile, injectedDependencyToVersion);

  // get pnpm-lock.yaml folder path
  const pnpmLockFolder = path.dirname(lockfilePath);

  // generate a map, where key is the absolute path of the injectedDependency, value is all available paths in .pnpm folder
  const injectedDependencyToFilePathSet: Map<string, Set<string>> = new Map();
  for (const [injectedDependency, injectedDependencyVersionSet] of injectedDependencyToVersion) {
    for (const injectedDependencyVersion of injectedDependencyVersionSet) {
      // this logic is heavily depends on pnpm-lock formate
      // the current logic is for pnpm v8
      // for example: file:../../libraries/lib1(react@16.0.0) -> ../../libraries/lib1
      let injectedDependencyPath = injectedDependencyVersion.split('(')[0].slice('file:'.length);
      injectedDependencyPath = path.resolve(pnpmLockFolder, injectedDependencyPath);
      if (!injectedDependencyToFilePathSet.has(injectedDependencyPath)) {
        injectedDependencyToFilePathSet.set(injectedDependencyPath, new Set());
      }

      const fullPackagePath = path.join(
        dotPnpmFolder,
        depPathToFilename(injectedDependencyVersion),
        'node_modules',
        injectedDependency
      );

      injectedDependencyToFilePathSet.get(injectedDependencyPath)?.add(fullPackagePath);
    }
  }

  // now, we have everything we need to generate the the .pnpm-sync.json
  // console.log('injectedDependencyToFilePathSet =>', injectedDependencyToFilePathSet);
  for (const [projectFolder, targetFolderSet] of injectedDependencyToFilePathSet) {
    if (targetFolderSet.size === 0) {
      continue;
    }

    const pnpmSyncJsonFolder = `${projectFolder}/node_modules`;
    const pnpmSyncJsonPath = `${pnpmSyncJsonFolder}/.pnpm-sync.json`;

    logMessageCallback({
      message: `Writing ${pnpmSyncJsonPath}`,
      messageKind: LogMessageKind.VERBOSE,
      details: {
        messageIdentifier: LogMessageIdentifier.PREPARE_WRITING_FILE,
        pnpmSyncJsonPath,
        projectFolder
      }
    });

    // make sure the node_modules folder exists, if not, create it
    // why?
    // in the transitive injected dependencies case
    // it is possible that node_modules folder for a package is not exist yet
    // but we need to generate .pnpm-sync.json for that package
    if (!fs.existsSync(pnpmSyncJsonFolder)) {
      await ensureFolderAsync(pnpmSyncJsonFolder);
    }

    const expectedPnpmSyncJsonVersion: string = pnpmSyncGetJsonVersion();

    let pnpmSyncJsonFile: IPnpmSyncJson = {
      version: expectedPnpmSyncJsonVersion,
      postbuildInjectedCopy: {
        sourceFolder: '..', // path from pnpmSyncJsonFolder to projectFolder
        targetFolders: []
      }
    };

    // if .pnpm-sync.json already exists, read it first
    if (fs.existsSync(pnpmSyncJsonPath)) {
      const existingPnpmSyncJsonFile: IPnpmSyncJson = JSON.parse(
        fs.readFileSync(pnpmSyncJsonPath).toString()
      );

      const actualPnpmSyncJsonVersion: string = existingPnpmSyncJsonFile?.version;
      if (actualPnpmSyncJsonVersion === expectedPnpmSyncJsonVersion) {
        pnpmSyncJsonFile = existingPnpmSyncJsonFile;
      } else {
        logMessageCallback({
          message: `The .pnpm-sync.json file in ${pnpmSyncJsonFolder} has an incompatible version; pnpm-sync will regenerate it.`,
          messageKind: LogMessageKind.VERBOSE,
          details: {
            messageIdentifier: LogMessageIdentifier.PREPARE_REPLACING_FILE,
            pnpmSyncJsonPath,
            projectFolder,
            actualVersion: actualPnpmSyncJsonVersion,
            expectedVersion: expectedPnpmSyncJsonVersion
          }
        });
      }
    }

    const existingTargetFolderSet: Set<string> = new Set();

    for (const targetFolder of pnpmSyncJsonFile.postbuildInjectedCopy.targetFolders) {
      existingTargetFolderSet.add(targetFolder.folderPath);
    }

    for (const targetFolder of targetFolderSet) {
      let relativePath: string = path.relative(pnpmSyncJsonFolder, targetFolder);

      // the final path in .pnpm-sync.json will always in posix style
      relativePath = relativePath.split(path.sep).join(path.posix.sep);

      if (!existingTargetFolderSet.has(relativePath)) {
        pnpmSyncJsonFile.postbuildInjectedCopy.targetFolders.push({
          folderPath: relativePath
        });
      }
    }

    await fs.promises.writeFile(pnpmSyncJsonPath, JSON.stringify(pnpmSyncJsonFile, null, 2));
  }

  const endTime = process.hrtime.bigint();
  const executionTimeInMs: number = Number(endTime - startTime) / 1e6;

  logMessageCallback({
    message: `Regenerated .pnpm-sync.json in ${executionTimeInMs.toFixed(3)} ms for ${lockfilePath}`,
    messageKind: LogMessageKind.INFO,
    details: {
      messageIdentifier: LogMessageIdentifier.PREPARE_FINISHING,
      lockfilePath,
      dotPnpmFolder,
      executionTimeInMs
    }
  });
}

function getInjectedDependencyToVersion(
  dependencies: Record<string, IVersionSpecifier> | undefined,
  injectedDependencyToVersion: Map<string, Set<string>>
): void {
  if (dependencies) {
    for (const [dependency, specifier] of Object.entries(dependencies)) {
      const specifierToUse: string = typeof specifier === 'string' ? specifier : specifier.version;
      // the injected dependency should always start with file protocol
      if (specifierToUse.startsWith('file:')) {
        if (!injectedDependencyToVersion.has(dependency)) {
          injectedDependencyToVersion.set(dependency, new Set());
        }
        injectedDependencyToVersion.get(dependency)?.add(specifierToUse);
      }
    }
  }
}

// process all dependencies and devDependencies to find potential transitive injected dependencies
// and add to injectedDependencyToFilePath map
function processTransitiveInjectedDependency(
  pnpmLockfile: ILockfile | undefined,
  injectedDependencyToVersion: Map<string, Set<string>>
): void {
  const potentialTransitiveInjectedDependencyVersionQueue: Array<string> = [];
  for (const injectedDependencyVersion of [...injectedDependencyToVersion.values()]) {
    potentialTransitiveInjectedDependencyVersionQueue.push(...injectedDependencyVersion);
  }

  const lockfilePackages: Record<string, ILockfilePackage> | undefined = pnpmLockfile?.packages;

  if (lockfilePackages) {
    while (potentialTransitiveInjectedDependencyVersionQueue.length > 0) {
      const transitiveInjectedDependencyVersion: string | undefined =
        potentialTransitiveInjectedDependencyVersionQueue.shift();
      if (transitiveInjectedDependencyVersion) {
        const { dependencies, optionalDependencies } = lockfilePackages[transitiveInjectedDependencyVersion];
        processInjectedDependencies(
          dependencies,
          injectedDependencyToVersion,
          potentialTransitiveInjectedDependencyVersionQueue
        );
        processInjectedDependencies(
          optionalDependencies,
          injectedDependencyToVersion,
          potentialTransitiveInjectedDependencyVersionQueue
        );
      }
    }
  }
}
function processInjectedDependencies(
  dependencies: Record<string, string> | undefined,
  injectedDependencyToVersion: Map<string, Set<string>>,
  potentialTransitiveInjectedDependencyVersionQueue: Array<string>
): void {
  if (dependencies) {
    for (const [dependency, version] of Object.entries(dependencies)) {
      // if the version is set with file: protocol, then it is a transitive injected dependency
      if (version.startsWith('file:')) {
        if (!injectedDependencyToVersion.has(dependency)) {
          injectedDependencyToVersion.set(dependency, new Set());
        }
        injectedDependencyToVersion.get(dependency)?.add(version);
        potentialTransitiveInjectedDependencyVersionQueue.push(version);
      }
    }
  }
}
