/**
 * This package provides an API for automating the actions performed by the
 * {@link https://www.npmjs.com/package/pnpm-sync | pnpm-sync package}.
 *
 * @packageDocumentation
 */

export { pnpmSyncCopyAsync, type IPnpmSyncCopyOptions } from './pnpmSyncCopy';
export { pnpmSyncPrepareAsync, type IPnpmSyncPrepareOptions } from './pnpmSyncPrepare';
export { ILogMessageKind } from './interfaces';
export type { ILockfile, ILockfileImporter, IVersionSpecifier, IDependencyMeta } from './interfaces';
