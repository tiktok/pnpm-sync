export interface IPnpmSyncCliArgs {
  prepare: boolean;
  lockfile: string;
  store: string;
}

export interface IPnpmSyncJson {
  postbuildInjectedCopy: {
    sourceFolder: string;
    targetFolders: Array<ITargetFolder>;
  };
}

export interface ITargetFolder {
  folderPath: string;
}

/**
 * @beta
 */
export enum ILogMessageKind {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  VERBOSE = 'verbose'
}

/**
 * @beta
 */
export interface IDependencyMeta {
  injected?: boolean;
}

/**
 * @beta
 */
export type IVersionSpecifier =
  | string
  | {
      version: string;
    };

/**
 * @beta
 */
export interface ILockfileImporter {
  dependencies?: Record<string, IVersionSpecifier>;
  devDependencies?: Record<string, IVersionSpecifier>;
  optionalDependencies?: Record<string, IVersionSpecifier>;
  dependenciesMeta?: Record<string, IDependencyMeta>;
}

/**
 * An abstraction of the pnpm lockfile
 *
 * @beta
 */
export interface ILockfile {
  importers: Record<string, ILockfileImporter>;
}
