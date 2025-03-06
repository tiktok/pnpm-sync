export interface IPnpmSyncCliArgs {
  prepare: boolean;
  lockfile: string;
  store: string;
}

export interface IPnpmSyncJson {
  version: string;
  postbuildInjectedCopy: {
    sourceFolder: string;
    targetFolders: Array<ITargetFolder>;
  };
}

export interface ITargetFolder {
  folderPath: string;
  lockfileId?: string;
}

export interface ISyncItem {
  absolutePath: string;
  isDirectory: boolean;
  isFile: boolean;
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
  // pnpmSyncPrepareAsync() messages
  PREPARE_STARTING = 'prepare-starting',
  PREPARE_ERROR_UNSUPPORTED_FORMAT = 'prepare-error-unsupported-format',
  PREPARE_ERROR_UNSUPPORTED_PNPM_VERSION = 'prepare-error-unsupported-pnpm-version',
  PREPARE_PROCESSING = 'prepare-processing',
  PREPARE_REPLACING_FILE = 'prepare-replacing-file',
  PREPARE_WRITING_FILE = 'prepare-writing-file',
  PREPARE_FINISHING = 'prepare-finishing',

  // pnpmSyncCopyAsync() messages
  COPY_STARTING = 'copy-starting',
  COPY_ERROR_NO_SYNC_FILE = 'copy-error-no-sync-file',
  COPY_ERROR_INCOMPATIBLE_SYNC_FILE = 'copy-error-incompatible-sync-file',
  COPY_FINISHING = 'copy-finishing'
}

/**
 * @beta
 */
export type LogMessageDetails =
  | {
      messageIdentifier: LogMessageIdentifier.PREPARE_STARTING;
      lockfilePath: string;
      dotPnpmFolder: string;
    }
  | {
      messageIdentifier: LogMessageIdentifier.PREPARE_ERROR_UNSUPPORTED_FORMAT;
      lockfilePath: string;
      lockfileVersion: string | undefined;
    }
  | {
      messageIdentifier: LogMessageIdentifier.PREPARE_ERROR_UNSUPPORTED_PNPM_VERSION;
      lockfilePath: string;
      pnpmVersion: string | undefined;
    }
  | {
      messageIdentifier: LogMessageIdentifier.PREPARE_PROCESSING;
      lockfilePath: string;
      dotPnpmFolder: string;
    }
  | {
      messageIdentifier: LogMessageIdentifier.PREPARE_REPLACING_FILE;
      pnpmSyncJsonPath: string;
      sourceProjectFolder: string;
      actualVersion: string;
      expectedVersion: string;
    }
  | {
      messageIdentifier: LogMessageIdentifier.PREPARE_WRITING_FILE;
      pnpmSyncJsonPath: string;
      sourceProjectFolder: string;
    }
  | {
      messageIdentifier: LogMessageIdentifier.PREPARE_FINISHING;
      lockfilePath: string;
      dotPnpmFolder: string;
      executionTimeInMs: number;
    }
  | {
      messageIdentifier: LogMessageIdentifier.COPY_STARTING;
      pnpmSyncJsonPath: string;
    }
  | {
      messageIdentifier: LogMessageIdentifier.COPY_ERROR_NO_SYNC_FILE;
      pnpmSyncJsonPath: string;
    }
  | {
      messageIdentifier: LogMessageIdentifier.COPY_ERROR_INCOMPATIBLE_SYNC_FILE;
      pnpmSyncJsonPath: string;
      actualVersion: string;
      expectedVersion: string;
    }
  | {
      messageIdentifier: LogMessageIdentifier.COPY_FINISHING;
      pnpmSyncJsonPath: string;
      fileCount: number;
      sourcePath: string;
      executionTimeInMs: number;
    };

/**
 * @beta
 */
export interface ILogMessageCallbackOptions {
  message: string;
  messageKind: LogMessageKind;
  details: LogMessageDetails;
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
      specifier: string;
      version: string;
    };

/**
 * Represents the installation plan for a local workspace project.
 * The `"peerDependencies"` field is not included in this data structure
 * because PNPM cannot install peer dependency doppelgangers for a local workspace
 * project (since they would need to be represented as injected dependencies).
 * @beta
 */
export interface ILockfileImporter {
  dependencies?: Record<string, IVersionSpecifier>;
  devDependencies?: Record<string, IVersionSpecifier>;
  optionalDependencies?: Record<string, IVersionSpecifier>;
  dependenciesMeta?: Record<string, IDependencyMeta>;
}

/**
 * @beta
 */
export interface ILockfilePackage {
  /** The list of dependencies and the resolved version */
  dependencies?: Record<string, string>;
  /** The list of optional dependencies and the resolved version */
  optionalDependencies?: Record<string, string>;
}

/**
 * This interface represents the data structure that is parsed from `pnpm-lock.yaml`
 *
 * @beta
 */
export interface ILockfile {
  /**
   * The version of the `pnpm-lock.yaml` file format.
   *
   * Example: `6.0`
   */
  lockfileVersion: number | string;
  importers: Record<string, ILockfileImporter>;
  /**
   * The `packages` section stores the installation plan for external (non-workspace)
   * packages.  The key is a `node_modules/.pnpm` version path, which in lockfile version 6
   * encodes the installed package name, package version, and any peer dependency qualifiers.
   *
   * Example key: `/webpack-filter-warnings-plugin@1.2.1(webpack@4.47.0)`
   */
  packages: Record<string, ILockfilePackage>;
}
