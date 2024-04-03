/**
 * Get .pnpm-sync.json version
 *
 * @beta
 */
export function getPnpmSyncJsonVersion(): string {
  return require('../package.json').version;
}
