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
export enum LogMessageKind {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  VERBOSE = 'verbose'
}

/**
 * @beta
 */
export enum LogMessageIdentifier {
  PREPARE_STARTING = 'Starting pnpm-sync prepare',
  PREPARE_PROCESSING = 'Processing pnpm-sync prepare',
  PREPARE_FINISHING = 'Finishing pnpm-sync prepare',
  COPY_STARTING = 'Starting pnpm-sync copy',
  COPY_PROCESSING = 'Processing pnpm-sync copy',
  COPY_FINISHING = 'Finishing pnpm-sync copy'
}

/**
 * @beta
 */
export interface ILogMessageCallbackOptions {
  message: string;
  messageKind: LogMessageKind;
  details:
    | {
        messageIdentifier: LogMessageIdentifier.PREPARE_STARTING;
        lockfilePath: string;
        dotPnpmFolderPath: string;
      }
    | {
        messageIdentifier: LogMessageIdentifier.PREPARE_PROCESSING;
        lockfilePath: string;
        dotPnpmFolderPath: string;
      }
    | {
        messageIdentifier: LogMessageIdentifier.PREPARE_FINISHING;
        lockfilePath: string;
        dotPnpmFolderPath: string;
        executionTimeInMs: string;
      }
    | {
        messageIdentifier: LogMessageIdentifier.COPY_STARTING;
        pnpmSyncJsonPath: string;
      }
    | {
        messageIdentifier: LogMessageIdentifier.COPY_PROCESSING;
        pnpmSyncJsonPath: string;
      }
    | {
        messageIdentifier: LogMessageIdentifier.COPY_FINISHING;
        pnpmSyncJsonPath: string;
        fileCount: number;
        executionTimeInMs: string;
      };
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
