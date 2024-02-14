import path from "path";
import fs from "fs";
import { cwd } from "process";

import type { ILockfile, IPnpmSyncJson, IVersionSpecifier } from "./interfaces";

/**
 * @beta
 */
export interface IPnpmSyncPrepareOptions {
  lockfilePath: string;
  storePath: string;
  readWantedLockfile: (
    lockfilePath: string,
    options: { ignoreIncompatible: boolean }
    // eslint-disable-next-line @rushstack/no-new-null
  ) => Promise<ILockfile | null>;
}

/**
 * For each workspace project has injected dependencies in a PNPM workspace, this API
 * should be invoked to prepare its `pnpm-sync.json` file.  While building projects,
 * that file will be used by {@link pnpmSyncCopyAsync} to recopy the build outputs into
 * injected dependency installation folders under the `node_modules` folder.
 *
 * @param lockfile - the path to the `pnpm-lock.yaml` file
 * @param store - the path to the PNPM store folder
 *
 * @beta
 */
export async function pnpmSyncPrepareAsync({
  lockfilePath,
  storePath,
  readWantedLockfile,
}: IPnpmSyncPrepareOptions): Promise<void> {
  console.log("Generate pnpm-sync.json ...");

  // get the pnpm-lock.yaml path
  lockfilePath = path.resolve(cwd(), lockfilePath);
  storePath = path.resolve(cwd(), storePath);

  console.log("The pnpm-lock.yaml file path =>", lockfilePath);
  console.log("The .pnpm folder path =>", storePath);

  if (!fs.existsSync(lockfilePath)) {
    throw Error("The input pnpm-lock.yaml path is not correct!");
  }

  console.time(`pnpm-sync prepare`);

  // read the pnpm-lock.yaml
  const pnpmLockFolder = lockfilePath.slice(
    0,
    lockfilePath.length - "pnpm-lock.yaml".length
  );
  const pnpmLockfile = await readWantedLockfile(pnpmLockFolder, {
    ignoreIncompatible: true,
  });

  // find injected dependency and all its available versions
  const injectedDependencyToVersion: Map<
    string,
    Set<string>
  > = getInjectedDependencyToVersion(pnpmLockfile);

  // generate a map, where key is the actual path of the injectedDependency, value is all available paths in .pnpm folder
  const injectedDependencyToFilePathSet: Map<string, Set<string>> = new Map();
  for (const [
    injectedDependency,
    injectedDependencyVersionSet,
  ] of injectedDependencyToVersion) {
    for (const injectedDependencyVersion of injectedDependencyVersionSet) {
      // this logic is heavily depends on pnpm-lock formate
      // the current logic is for pnpm v8
      // for example: file:../../libraries/lib1(react@16.0.0) -> ../../libraries/lib1
      let injectedDependencyPath = injectedDependencyVersion
        .split("(")[0]
        .slice("file:".length);
      injectedDependencyPath = path.resolve(
        pnpmLockFolder,
        injectedDependencyPath
      );
      if (!injectedDependencyToFilePathSet.has(injectedDependencyPath)) {
        injectedDependencyToFilePathSet.set(injectedDependencyPath, new Set());
      }

      injectedDependencyToFilePathSet
        .get(injectedDependencyPath)
        ?.add(
          transferFilePathToPnpmStorePath(
            injectedDependencyVersion,
            injectedDependency,
            storePath
          )
        );
    }
  }

  // now, we have everything we need to generate the the pnpm-sync.json
  // console.log('injectedDependencyToFilePathSet =>', injectedDependencyToFilePathSet);
  for (const [
    projectFolder,
    targetFolderSet,
  ] of injectedDependencyToFilePathSet) {
    if (targetFolderSet.size === 0) {
      continue;
    }

    const pnpmSyncJsonPath = `${projectFolder}/node_modules/.pnpm-sync.json`;

    let pnpmSyncJsonFile: IPnpmSyncJson = {
      postbuildInjectedCopy: {
        sourceFolder: "../..",
        targetFolders: [],
      },
    };

    // if .pnpm-sync.json already exists, read it first
    if (fs.existsSync(pnpmSyncJsonPath)) {
      pnpmSyncJsonFile = JSON.parse(
        fs.readFileSync(pnpmSyncJsonPath).toString()
      );
    }

    const existingTargetFolderSet: Set<string> = new Set();

    for (const targetFolder of pnpmSyncJsonFile.postbuildInjectedCopy
      .targetFolders) {
      existingTargetFolderSet.add(targetFolder.folderPath);
    }

    for (const targetFolder of targetFolderSet) {
      const relativePath = path.relative(pnpmSyncJsonPath, targetFolder);
      if (!existingTargetFolderSet.has(relativePath)) {
        pnpmSyncJsonFile.postbuildInjectedCopy.targetFolders.push({
          folderPath: relativePath,
        });
      }
    }
    fs.writeFileSync(
      pnpmSyncJsonPath,
      JSON.stringify(pnpmSyncJsonFile, null, 2)
    );
  }
  console.timeEnd(`pnpm-sync prepare`);
}

function transferFilePathToPnpmStorePath(
  rawFilePath: string,
  dependencyName: string,
  storePath: string
): string {
  // this logic is heavily depends on pnpm-lock format
  // the current logic is for pnpm v8

  // an example, file:../../libraries/lib1(react@16.0.0) -> file+..+..+libraries+lib1_react@16.9.0

  // 1. replace ':' with '+'
  rawFilePath = rawFilePath.replaceAll(":", "+");

  // 2. replace '/' with '+'
  rawFilePath = rawFilePath.replaceAll("/", "+");

  // 3. replace '(' with '_'
  rawFilePath = rawFilePath.replaceAll("(", "_");

  // 4. remove ')'
  rawFilePath = rawFilePath.replaceAll(")", "");

  // 5. add dependencyName
  rawFilePath = rawFilePath + `/node_modules/${dependencyName}`;

  rawFilePath = storePath + "/" + rawFilePath;

  return rawFilePath;
}

// process dependencies and devDependencies to generate injectedDependencyToFilePath
function getInjectedDependencyToVersion(
  // eslint-disable-next-line @rushstack/no-new-null
  pnpmLockfile: ILockfile | null
): Map<string, Set<string>> {
  const injectedDependencyToVersion: Map<string, Set<string>> = new Map();
  for (const importerKey in pnpmLockfile?.importers) {
    if (!pnpmLockfile?.importers[importerKey]?.dependenciesMeta) {
      continue;
    }
    const dependenciesMeta =
      pnpmLockfile?.importers[importerKey]?.dependenciesMeta;

    for (const dependency in dependenciesMeta) {
      if (dependenciesMeta[dependency]?.injected) {
        if (!injectedDependencyToVersion.has(dependency)) {
          injectedDependencyToVersion.set(dependency, new Set());
        }
      }
    }

    // based on https://pnpm.io/package_json#dependenciesmeta
    // the injected dependencies could available inside dependencies, optionalDependencies, and devDependencies.
    processDependencies(
      pnpmLockfile?.importers[importerKey]?.dependencies,
      injectedDependencyToVersion
    );
    processDependencies(
      pnpmLockfile?.importers[importerKey]?.devDependencies,
      injectedDependencyToVersion
    );
    processDependencies(
      pnpmLockfile?.importers[importerKey]?.optionalDependencies,
      injectedDependencyToVersion
    );
  }
  return injectedDependencyToVersion;
}
function processDependencies(
  dependencies: Record<string, IVersionSpecifier> | undefined,
  injectedDependencyToVersion: Map<string, Set<string>>
): void {
  if (dependencies) {
    for (const [dependency, specifier] of Object.entries(dependencies)) {
      if (injectedDependencyToVersion.has(dependency)) {
        const specifierToUse: string =
          typeof specifier === "string" ? specifier : specifier.version;
        injectedDependencyToVersion.get(dependency)?.add(specifierToUse);
      }
    }
  }
}
