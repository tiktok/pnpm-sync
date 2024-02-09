export interface IPnpmSyncCliArgs {
  prepare: boolean,
  lockfile: string,
  store: string
} 

export interface IPnpmSyncJson {
  postbuildInjectedCopy: {
    sourceFolder: string,
    targetFolders: Array<ITargetFolder>
  }
}

export interface ITargetFolder {
  folderPath: string
}

