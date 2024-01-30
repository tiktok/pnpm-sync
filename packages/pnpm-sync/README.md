# pnpm-sync

For use with the [PNPM package manager](https://pnpm.io/), the `pnpm-sync` tool provides a way to recopy injected dependencies whenever local workspace projects are rebuilt.  It provides a missing feature that was discussed in [PNPM issue #4407](https://github.com/pnpm/pnpm/issues/4407). We hope to eventually contribute this work into the official PNPM project.  For details, see the [repository README.md](https://github.com/tiktok/pnpm-sync/blob/main/README.md).

## What are injected dependencies?

PNPM generally avoids [NPM doppelgangers](https://lfx.rushstack.io/pages/concepts/install_models/) by creating symlinks.  However for certain installation problems involving peer dependencies, PNPM cannot correctly satisfy versioning requirements without installing duplicate copies of the same version of the same package under the **node_modules** folder.  In particular this poses a problem for `workspace:*` dependencies, as they are normally installed by making a symlink to the local project's source folder.

Here is an example:

**packages/my-lib/package.json**
```js
{
  "name": "my-lib",
  "peerDependencies": {
    // The library supports multiple versions of React:
    "react": "^16.0.0 || ^17.0.0 || ^18.0.0"
  },
  "devDependencies" {
    // For local development in the PNPM workspace, we install the oldest one:
    "react": "^16.0.0"
  }
}
```

**packages/my-app/package.json**
```js
{
  "name": "my-app",
  "dependencies": {
    "my-lib": "workspace:*"
  },
  "devDependencies" {
    // This app ships with the latest version of React
    "react": "^18.0.0"
  }
}
```

When imported by `my-app`, the `require("react")` call inside **my-lib/lib/index.js** should resolve React 18.  Whereas when imported by **my-lib/src/tests/my-jest-test.ts**, that same `require("react")` call should resolve to React 16.  Maybe there is also some `old-app` project in the monorepo using React 16 as well.  Conventional module resolution stipulates that inside a given file path, `require("react")` always returns the same version regardless of how it was imported.  Thus, in order to resolve the appropriate version for these different consumers, the package manager must make an alternate file path by copying the package folder under **node_modules**. This copy is called a "doppelganger".

The `pnpm install` command already does this automatically for downloaded tarballs, and it also has the ability to copy a local workspace project folder, via the ["injected dependencies"](https://pnpm.io/package_json#dependenciesmetainjected) feature.  However there is a timing problem:  this copy should be updated whenever the project is rebuilt and *before* its consumer starts to build, which is much later than the `pnpm install` operation.  That is why we need a new command `pnpm-sync`.

## Two possible designs

This feature was originally proposed in **Rush Subspaces RFC #4230**, which considered [two possible designs](https://github.com/microsoft/rushstack/blob/main/common/docs/rfcs/rfc-4230-rush-subspaces.md#observation-1-we-need-a-postbuild-event):


1. **"prebuild" syncing:** (NOT SUPPORTED YET)  The `pnpm-sync` copying occurs while building **my-app**, as the very first step before anything else.  If **my-app** has multiple injected dependencies, they all get resynced together.  If this operation performs multiple copies, they would be different injected dependencies (**my-lib**, **my-lib2**, etc).

2. **"postbuild" syncing:**  The `pnpm-sync` copying occurs while building **my-lib**, as a final step before projects such as **my-app** can start their build.  If this operation performs multiple copies, they would be doppelgangers of **my-lib** (**my-lib+react@17**, **my-lib+react@18**, etc).

Both approaches can work and have different tradeoffs discussed in the RFC.  Initially we chose to implement the **"postbuild"** workflow only.


## Command-line interface

Typical workflow:

1. Configure injected dependencies for the consuming projects.  Continuing our example from above:

   **packages/my-app/package.json**
   ```js
   {
     "name": "my-app",
     "dependencies": {
       "my-lib": "workspace:*"
     },
     "devDependencies" {
       "react": "^18.0.0"
     },
     "dependenciesMeta": {
       "my-lib": {
         "injected": true  // <-- add this
       }
     },
   }
   ```

2. Run `pnpm install` to install your PNPM workspace dependencies:

   ```bash
   cd my-repo

   pnpm install
   ```

3. Run `pnpm-sync prepare` to create the injected dependency

   ```bash
   cd packages/my-app

   # Creates packages/my-app/node_modules/.pnpm-sync.json
   pnpm-sync prepare --lockfile=../pnpm-lock.yaml --store=../node_modules/.pnpm
   ```

4. Build the projects, invoking `pnpm-sync copy` at the appropriate times:

   ```bash
   cd packages/my-lib

   pnpm run build

   # Recopies "packages/my-lib" outputs into the doppelganger folder under "my-app/node_modules"
   pnpm-sync copy
   ```

   ```bash
   cd packages/my-app

   pnpm run build
   ```

A complete tutorial example can be found in this folder: [pnpm-sync/pnpm-sync-cli-demo/](https://github.com/tiktok/pnpm-sync/tree/main/pnpm-sync-cli-demo)

## API library

It would be cumbersome for each project's **package.json** to perform this recopying, and easy for mistakes to occur.  It would be better for this copying to be managed automatically by your monorepo toolchain.  To support that, we've provided an API package [pnpm-sync-lib](https://www.npmjs.com/package/pnpm-sync-lib) that exposes the same basic operations.

A complete tutorial example can be found in this folder: [pnpm-sync/pnpm-sync-api-demo/](https://github.com/tiktok/pnpm-sync/tree/main/pnpm-sync-api-demo)

## 💬 Tell us what you think

GitHub issues and pull requests are welcome in the [pnpm-sync repository](https://github.com/tiktok/pnpm-sync/).  For general discussions about the feature idea, please comment on the upstream GitHub issue:

[(pnpm/pnpm#4407) Injected dependencies are not recopied after a workspace project is rebuilt](https://github.com/pnpm/pnpm/issues/4407)

## See also

- [pnpm-sync-lib](https://www.npmjs.com/package/pnpm-sync-lib) API package
- [Rush Subspaces RFC #4230](https://github.com/microsoft/rushstack/blob/main/common/docs/rfcs/rfc-4230-rush-subspaces.md)
