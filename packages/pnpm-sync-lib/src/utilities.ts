/**
 * Get .pnpm-sync.json version
 *
 * @beta
 */
export function pnpmSyncGetJsonVersion(): string {
  return require('../package.json').version;
}
