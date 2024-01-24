export interface PnpmSyncCliArgs {
  prepare: boolean,
  lockfile: string,
  store: string
} 

export interface PnpmSyncJson {
  postbuildInjectedCopy: {
    sourceFolder: string,
    targetFolders: Array<TargetFolder>
  }
}

export interface TargetFolder {
  folderPath: string
}

export const ALL_APP = 'all';

