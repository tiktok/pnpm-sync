# Test Fixtures Guide

This directory contains test fixtures for the pnpm-sync project, providing various workspace configurations and sample projects to test different scenarios and pnpm versions.

## Directory Structure Overview

### PNPM Version-Specific Workspaces

The `pnpm-vX` directories contain complete workspace setups for testing different versions of pnpm:

Each pnpm version directory contains:
- `package.json` - Root workspace configuration with specific pnpm version
- `pnpm-workspace.yaml` - Workspace package definitions
- `pnpm-lock.yaml` - Version-specific lockfile format
- `apps/` - Sample applications (sample-app1, sample-app2)
- `packages/` - Sample libraries designed for testing complex dependency scenarios
  - `sample-lib1` - A React component library with extensive peer dependencies configuration, specifically designed to trigger pnpm's dependency path hashing logic.

## How to Add New Test Fixtures

### Adding a New PNPM Version Workspace

1. **Copy existing pnpm version directory**:
   ```bash
   # Copy from an existing pnpm-vX directory as template
   cp -r pnpm-v9 pnpm-vX
   cd pnpm-vX
   ```

2. **Set the target pnpm version using [`corepack`](https://github.com/nodejs/corepack)**:
   ```bash
   # Use corepack to set and record the specific pnpm version
   corepack use pnpm@X.Y.Z
   ```
   This command will:
   - Install the specified pnpm version if not already available
   - Update the `packageManager` field in `package.json` automatically
   - Ensure the workspace uses the exact pnpm version for testing

3. **Verify the version configuration**:
   ```bash
   # Check that package.json has been updated correctly
   cat package.json | grep packageManager
   # Should show: "packageManager": "pnpm@X.Y.Z+sha512..."
   
   # Verify pnpm version
   corepack pnpm --version
   ```

4. **Update workspace name** (if needed):
   ```json
   {
     "name": "pnpm-vX-workspace",
     "version": "0.0.0",
     "packageManager": "pnpm@X.Y.Z+sha512..." // Auto-updated by corepack
   }
   ```

5. **Regenerate lockfile with new pnpm version**:
   ```bash
   # Remove old lockfile and regenerate with new pnpm version
   rm pnpm-lock.yaml
   corepack pnpm install
   ```

6. **Add version to test suite**:
   Update the test file to include the new version:
   ```typescript
   // tests/pnpm-sync-api-test/src/test/pnpmMultiVersion.test.ts
   it.each(['8', '9', '10', 'X'])('pnpm v%s', async (version) => {
   ```

7. **Run tests to verify**:
   ```bash
   # Navigate to test directory and run the multi-version test
   cd ../../pnpm-sync-api-test
   npm test
   ```

### Important Notes

- **Corepack Advantage**: Using `corepack use pnpm@X.Y.Z` ensures the `packageManager` field is automatically updated with the correct SHA512 hash, eliminating manual errors.
- **Version Consistency**: This approach guarantees that the directory name, package.json configuration, and actual pnpm binary version are all synchronized.
- **Test Integration**: Always add the new version to the test suite to ensure it's covered in CI/CD pipelines.
- **Lockfile Regeneration**: The lockfile format may differ between pnpm versions, so regeneration is essential for accurate testing.
        

### Best Practices

1. **Naming Convention**: Use descriptive names that indicate the purpose (e.g., `pnpm-v11.1.2`, `sample-complex-app`)

2. **Version Consistency**: Ensure package manager versions in package.json match the directory name

3. **Dependency Injection**: Use `dependenciesMeta.injected: true` for workspace dependencies that should be injected

4. **TypeScript Configuration**: Extend base configurations rather than duplicating settings

5. **Documentation**: Update this README when adding new fixtures with their specific purpose

## Usage in Tests

These fixtures are used by the pnpm-sync test suite to:
- Verify cross-version compatibility
- Test workspace dependency resolution
- Validate dependency injection behavior
- Test migration scenarios between pnpm versions
- Ensure proper handling of different project structures

Each fixture represents a specific test scenario and should be maintained to reflect real-world usage patterns.
        