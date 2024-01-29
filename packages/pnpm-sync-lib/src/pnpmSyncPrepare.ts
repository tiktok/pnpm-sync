import { PnpmSyncJson } from './interfaces';
import { readWantedLockfile, type Lockfile, type Dependencies } from '@pnpm/lockfile-file';
import path from 'path';
import fs from 'fs';
import { cwd } from 'process';

export async function pnpmSyncPrepare(lockfile: string, store: string): Promise<void> {
  console.log('Generate pnpm-sync.json ...')

  // get the pnpm-lock.yaml path
  const lockfilePath = path.resolve(cwd(), lockfile);
  const storePath = path.resolve(cwd(), store);

  console.log('The pnpm-lock.yaml file path =>', lockfilePath);
  console.log('The .pnpm folder path =>', storePath)

  if (!fs.existsSync(lockfilePath)) {
    throw Error('The input pnpm-lock.yaml path is not correct!')
  }

  console.time(`pnpm-sync prepare`);

  // read the pnpm-lock.yaml
  const pnpmLockFolder = lockfilePath.slice(0, lockfilePath.length - 'pnpm-lock.yaml'.length);
  const pnpmLockfile = await readWantedLockfile(pnpmLockFolder, {ignoreIncompatible: true});


  // find injected dependency and all its available versions
  const injectedDependencyToVersion: Map<string, Set<string>> = getInjectedDependencyToVersion(pnpmLockfile);
  
  // generate a map, where key is the actual path of the injectedDependency, value is all available paths in .pnpm folder
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

      injectedDependencyToFilePathSet.get(injectedDependencyPath)?.add(transferFilePathToPnpmStorePath(injectedDependencyVersion, injectedDependency, storePath))
    }
  }

  // now, we have everything we need to generate the the pnpm-sync.json
  // console.log('injectedDependencyToFilePathSet =>', injectedDependencyToFilePathSet);
  for (const [projectFolder, targetFolderSet] of injectedDependencyToFilePathSet) {
    if (targetFolderSet.size === 0) {
      continue;
    }

    const pnpmSyncJsonPath = `${projectFolder}/node_modules/.pnpm-sync.json`;

    let pnpmSyncJsonFile: PnpmSyncJson = {
      postbuildInjectedCopy: {
        sourceFolder: '../..',
        targetFolders: []
      }
    }
  
    // if .pnpm-sync.json already exists, read it first
    if (fs.existsSync(pnpmSyncJsonPath)) {
      pnpmSyncJsonFile = JSON.parse(fs.readFileSync(pnpmSyncJsonPath).toString());
    }
  
    const existingTargetFolderSet: Set<string> = new Set();
  
    for (const targetFolder of pnpmSyncJsonFile.postbuildInjectedCopy.targetFolders) {
      existingTargetFolderSet.add(targetFolder.folderPath);
    }
  
    for (const targetFolder of targetFolderSet) {
      const relativePath = path.relative(pnpmSyncJsonPath, targetFolder);
      if (!existingTargetFolderSet.has(relativePath)) {
        pnpmSyncJsonFile.postbuildInjectedCopy.targetFolders.push({
          folderPath: relativePath
        })
      }
    }
    fs.writeFileSync(pnpmSyncJsonPath, JSON.stringify(pnpmSyncJsonFile, null, 2));
  }
  console.timeEnd(`pnpm-sync prepare`);
}

function transferFilePathToPnpmStorePath (rawFilePath: string, dependencyName:string, storePath: string): string {
  // this logic is heavily depends on pnpm-lock format
  // the current logic is for pnpm v8

  // an example, file:../../libraries/lib1(react@16.0.0) -> file+..+..+libraries+lib1_react@16.9.0

  // 1. replace ':' with '+' 
  rawFilePath = rawFilePath.replaceAll(':', '+');

  // 2. replace '/' with '+' 
  rawFilePath = rawFilePath.replaceAll('/', '+');

  // 3. replace '(' with '_'
  rawFilePath = rawFilePath.replaceAll('(', '_');

  // 4. remove ')'
  rawFilePath = rawFilePath.replaceAll(')', '');

  // 5. add dependencyName
  rawFilePath = rawFilePath + `/node_modules/${dependencyName}`

  rawFilePath = storePath + '/' + rawFilePath;

  return rawFilePath
}


// process dependencies and devDependencies to generate injectedDependencyToFilePath
function getInjectedDependencyToVersion (pnpmLockfile: Lockfile | null): Map<string, Set<string>> {
  const injectedDependencyToVersion: Map<string, Set<string>> = new Map();
  for (const importerKey in pnpmLockfile?.importers) {
    const dependenciesMeta = pnpmLockfile?.importers[importerKey]?.dependenciesMeta;
    if (!dependenciesMeta) {
      continue;
    }

    for (const dependency in dependenciesMeta){
      if (dependenciesMeta[dependency]?.injected){
        if (!injectedDependencyToVersion.has(dependency)) {
          injectedDependencyToVersion.set(dependency, new Set());
        }
      }
    }

    // based on https://pnpm.io/package_json#dependenciesmeta
    // the injected dependencies could available inside dependencies, optionalDependencies, and devDependencies.
    processDependencies(pnpmLockfile?.importers[importerKey]?.dependencies, injectedDependencyToVersion);
    processDependencies(pnpmLockfile?.importers[importerKey]?.devDependencies, injectedDependencyToVersion);
    processDependencies(pnpmLockfile?.importers[importerKey]?.optionalDependencies, injectedDependencyToVersion);
  }

  return injectedDependencyToVersion;
}
function processDependencies(dependencies: Dependencies | undefined, injectedDependencyToVersion: Map<string, Set<string>>) {
  if (dependencies) {
    for (const dependency in dependencies) {
      if (injectedDependencyToVersion.has(dependency)){
        injectedDependencyToVersion.get(dependency)?.add(dependencies[dependency]);
      }
    }  
  }
}