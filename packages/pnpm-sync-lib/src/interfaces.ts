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
  PREPARE_STARTING = 'prepare-starting',
  PREPARE_PROCESSING = 'prepare-processing',
  PREPARE_FINISHING = 'prepare-finishing',
  COPY_STARTING = 'copy-starting',
  COPY_PROCESSING = 'copy-processing',
  COPY_FINISHING = 'copy-finishing'
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
