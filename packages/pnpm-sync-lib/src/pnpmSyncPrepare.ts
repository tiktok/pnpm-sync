import path from 'path';
import fs from 'fs';
import YAML from 'yaml';
import process from 'node:process';
import { depPathToFilename as depPathToFilename2 } from '@pnpm/dependency-path-2';
import { depPathToFilename as depPathToFilename5 } from '@pnpm/dependency-path-5';

import {
  ILockfile,
  ILogMessageCallbackOptions,
  LogMessageKind,
  LogMessageIdentifier,
  IPnpmSyncJson,
  IVersionSpecifier,
  ITargetFolder
} from './interfaces';
import { pnpmSyncGetJsonVersion } from './utilities';

/**
 * @beta
 */
export interface IPnpmSyncUpdateFileBaseOptions {
  /**
   * A lockfileId that can be used to recognize the `pnpm-lock.yaml`
   */
  lockfileId?: string;

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
 * @beta
 */
export interface IPnpmSyncPrepareOptions extends IPnpmSyncUpdateFileBaseOptions {
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
}

/**
 * @beta
 */
export interface IPnpmSyncUpdateFileOptions extends IPnpmSyncUpdateFileBaseOptions {
  /**
   * The folder path of the project whose build outputs will get synced into the node_modules folder
   * of dependent projects.
   * @remarks
   * It be an absolute file path, such as `/path/to/my-library`, which will have a sync file
   * `/path/to/my-library/node_modules/.pnpm-sync.json`
   */
  sourceProjectFolder: string;

  /**
   * A list of destination folders that `pnpmSyncCopyAsync()` will copy into.
   *
   * @remarks
   * Each string should be an absolute file path to a folder, whose name will generally
   * be the same as the `sourceProjectFolder`'s directory name.
   *
   * For example:
   * `/path/to/my-workspace/node_modules/.pnpm/my-library@1.2.3/node_modules/my-library`
   *
   * When your tool needs to update this set of files, providing the `IPnpmSyncUpdateFileBaseOptions.lockfileId`
   * will enable `pnpmSyncUpdateFileAsync()` to clear the old target folders from `.pnpm-sync.json`
   * before adding the new ones.
   */
  targetFolders: Array<string>;
}

/**
 * @beta
 */
export async function pnpmSyncUpdateFileAsync(options: IPnpmSyncUpdateFileOptions): Promise<void> {
  const { lockfileId, logMessageCallback, sourceProjectFolder, targetFolders } = options;

  const pnpmSyncJsonFolder = `${sourceProjectFolder}/node_modules`;
  const pnpmSyncJsonPath = `${pnpmSyncJsonFolder}/.pnpm-sync.json`;
  const expectedPnpmSyncJsonVersion: string = pnpmSyncGetJsonVersion();

  let pnpmSyncJsonFile: IPnpmSyncJson = {
    version: expectedPnpmSyncJsonVersion,
    postbuildInjectedCopy: {
      sourceFolder: '..', // path from pnpmSyncJsonFolder to sourceProjectFolder
      targetFolders: []
    }
  };

  // if .pnpm-sync.json already exists, read it first
  if (fs.existsSync(pnpmSyncJsonPath)) {
    let existingPnpmSyncJsonFile: IPnpmSyncJson | undefined;
    try {
      existingPnpmSyncJsonFile = JSON.parse(fs.readFileSync(pnpmSyncJsonPath).toString());
    } catch (e) {
      // no-catch
      // Regenerate .pnpm-sync.json when failed to load the current one
    }

    if (existingPnpmSyncJsonFile) {
      const actualPnpmSyncJsonVersion: string = existingPnpmSyncJsonFile.version;
      if (actualPnpmSyncJsonVersion === expectedPnpmSyncJsonVersion) {
        // If a lockfileId is provided
        // then all entries with this lockfileId should be deleted
        // they will be regenerated later
        if (lockfileId) {
          const filteredTargetFolders = existingPnpmSyncJsonFile.postbuildInjectedCopy.targetFolders.filter(
            (targetFolder) => targetFolder?.lockfileId !== lockfileId
          );
          existingPnpmSyncJsonFile.postbuildInjectedCopy.targetFolders = filteredTargetFolders;
        }
        pnpmSyncJsonFile = existingPnpmSyncJsonFile;
      } else {
        logMessageCallback({
          message: `The .pnpm-sync.json file in ${pnpmSyncJsonFolder} has an incompatible version; pnpm-sync will regenerate it.`,
          messageKind: LogMessageKind.VERBOSE,
          details: {
            messageIdentifier: LogMessageIdentifier.PREPARE_REPLACING_FILE,
            pnpmSyncJsonPath,
            sourceProjectFolder,
            actualVersion: actualPnpmSyncJsonVersion,
            expectedVersion: expectedPnpmSyncJsonVersion
          }
        });
      }
    }
  }

  const existingTargetFolderSet: Set<string> = new Set();

  for (const targetFolder of pnpmSyncJsonFile.postbuildInjectedCopy.targetFolders) {
    existingTargetFolderSet.add(targetFolder.folderPath);
  }

  for (const targetFolder of targetFolders) {
    let relativePath: string = path.relative(pnpmSyncJsonFolder, targetFolder);

    // the final path in .pnpm-sync.json will always in posix style
    relativePath = relativePath.split(path.sep).join(path.posix.sep);

    if (!existingTargetFolderSet.has(relativePath)) {
      const targetFolderItem: ITargetFolder = {
        folderPath: relativePath
      };

      if (lockfileId) {
        targetFolderItem.lockfileId = lockfileId;
      }

      pnpmSyncJsonFile.postbuildInjectedCopy.targetFolders.push(targetFolderItem);
    }
  }

  await fs.promises.writeFile(pnpmSyncJsonPath, JSON.stringify(pnpmSyncJsonFile, null, 2));
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
  const { lockfileId, ensureFolderAsync, readPnpmLockfile, logMessageCallback } = options;
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
  if (!pnpmVersion || !(pnpmVersion.startsWith('8') || pnpmVersion.startsWith('9'))) {
    logMessageCallback({
      message: `The pnpm version is not supported; pnpm-sync requires pnpm version 8.x, 9.x`,
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
  if (
    !pnpmLockfile ||
    !lockfileVersion ||
    !(lockfileVersion.startsWith('6') || lockfileVersion.startsWith('9'))
  ) {
    logMessageCallback({
      message: `The pnpm-lock.yaml format is not supported; pnpm-sync requires lockfile version 6, 9`,
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
  for (const importerItem of Object.values(pnpmLockfile.importers || {})) {
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
  const injectedDependencyToFilePathSet: Map<string, Array<string>> = new Map();
  for (const [injectedDependency, injectedDependencyVersionSet] of injectedDependencyToVersion) {
    for (const injectedDependencyVersion of injectedDependencyVersionSet) {
      // this logic is heavily depends on pnpm-lock formate
      // the current logic is for pnpm v8
      // for example: file:../../libraries/lib1(react@16.0.0) -> ../../libraries/lib1
      let injectedDependencyPath = injectedDependencyVersion.split('(')[0].slice('file:'.length);
      injectedDependencyPath = path.resolve(pnpmLockFolder, injectedDependencyPath);
      if (!injectedDependencyToFilePathSet.has(injectedDependencyPath)) {
        injectedDependencyToFilePathSet.set(injectedDependencyPath, []);
      }

      const packageDirname = (() => {
        if (pnpmVersion.startsWith('8')) {
          return depPathToFilename2(injectedDependencyVersion);
        }
        if (pnpmVersion.startsWith('9')) {
          return depPathToFilename5(injectedDependency + '@' + injectedDependencyVersion, 120);
        }
        return '';
      })();

      const fullPackagePath = path.join(dotPnpmFolder, packageDirname, 'node_modules', injectedDependency);

      injectedDependencyToFilePathSet.get(injectedDependencyPath)?.push(fullPackagePath);
    }
  }

  // now, we have everything we need to generate the the .pnpm-sync.json
  // console.log('injectedDependencyToFilePathSet =>', injectedDependencyToFilePathSet);
  for (const [sourceProjectFolder, targetFolders] of injectedDependencyToFilePathSet) {
    if (targetFolders.length === 0) {
      continue;
    }

    const pnpmSyncJsonFolder = `${sourceProjectFolder}/node_modules`;
    const pnpmSyncJsonPath = `${pnpmSyncJsonFolder}/.pnpm-sync.json`;

    logMessageCallback({
      message: `Writing ${pnpmSyncJsonPath}`,
      messageKind: LogMessageKind.VERBOSE,
      details: {
        messageIdentifier: LogMessageIdentifier.PREPARE_WRITING_FILE,
        pnpmSyncJsonPath,
        sourceProjectFolder
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

    await pnpmSyncUpdateFileAsync({
      sourceProjectFolder,
      targetFolders,
      logMessageCallback,
      lockfileId
    });
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
      // and exclude tarball installation
      // what is the tarball installation, learn more: https://pnpm.io/cli/add#install-from-local-file-system

      const tarballSuffix = ['.tar', '.tar.gz', '.tgz'];
      if (
        specifierToUse.startsWith('file:') &&
        !tarballSuffix.some((suffix) => specifierToUse.endsWith(suffix))
      ) {
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
  pnpmLockfile: ILockfile,
  injectedDependencyToVersion: Map<string, Set<string>>
): void {
  const { lockfileVersion } = pnpmLockfile;

  const potentialTransitiveInjectedDependencyVersionQueue: Array<string> = [];
  for (const [packageName, injectedDependencyVersion] of [...injectedDependencyToVersion.entries()]) {
    if (lockfileVersion.toString().startsWith('6')) {
      potentialTransitiveInjectedDependencyVersionQueue.push(...injectedDependencyVersion);
    } else if (lockfileVersion.toString().startsWith('9')) {
      potentialTransitiveInjectedDependencyVersionQueue.push(
        ...[...injectedDependencyVersion].map((version) => packageName + '@' + version)
      );
    }
  }

  const { packages: lockfilePackages } = pnpmLockfile;

  while (potentialTransitiveInjectedDependencyVersionQueue.length > 0) {
    const transitiveInjectedDependencyVersion: string | undefined =
      potentialTransitiveInjectedDependencyVersionQueue.shift();
    if (transitiveInjectedDependencyVersion) {
      const { dependencies, optionalDependencies } = lockfilePackages[transitiveInjectedDependencyVersion];
      processInjectedDependencies(
        dependencies,
        injectedDependencyToVersion,
        potentialTransitiveInjectedDependencyVersionQueue,
        pnpmLockfile
      );
      processInjectedDependencies(
        optionalDependencies,
        injectedDependencyToVersion,
        potentialTransitiveInjectedDependencyVersionQueue,
        pnpmLockfile
      );
    }
  }
}
function processInjectedDependencies(
  dependencies: Record<string, string> | undefined,
  injectedDependencyToVersion: Map<string, Set<string>>,
  potentialTransitiveInjectedDependencyVersionQueue: Array<string>,
  pnpmLockfile: ILockfile
): void {
  if (dependencies) {
    const { lockfileVersion } = pnpmLockfile;
    for (const [dependency, version] of Object.entries(dependencies)) {
      // if the version is set with file: protocol, then it is a transitive injected dependency
      if (version.startsWith('file:')) {
        if (!injectedDependencyToVersion.has(dependency)) {
          injectedDependencyToVersion.set(dependency, new Set());
        }
        injectedDependencyToVersion.get(dependency)?.add(version);
        if (lockfileVersion.toString().startsWith('6')) {
          potentialTransitiveInjectedDependencyVersionQueue.push(version);
        } else if (lockfileVersion.toString().startsWith('9')) {
          potentialTransitiveInjectedDependencyVersionQueue.push(dependency + '@' + version);
        }
      }
    }
  }
}
