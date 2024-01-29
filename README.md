# pnpm-sync

## Background

The `pnpm-sync` command provides a way to resync injected dependencies when using the PNPM package manager, based on the proposal from the Rush [Subspaces RFC #4230](https://github.com/microsoft/rushstack/issues/4230).

**Problem:** The PNPM package manager installs "injected" dependencies by copying the build output of a local workspace project into one or more symlinked **node_modules** subfolders. Today, PNPM performs this copying only once during the initial `pnpm install`, but that is not a complete solution; the output should really be copied whenever the project is rebuilt.

**Solution:** The `pnpm-sync` tool provides a way to perform this copying. It is invoked for each project that is an injected dependency provider in the PNPM workspace. It should be run after the project finishes building (before its consumers are built).  The operation can be performed via a command-line interface (CLI) or via an application program interface (API) for toolchain integration.

**Setup:** The operation is optimized by precomputing the source/target folder locations and storing this information in a new file (**&lt;your-library&gt;/node_modules/.pnpm-sync.json**). In our implementation, the `pnpm-sync prepare` step should be performed after `pnpm install` to write the JSON file.  Then, during the build the `pnpm-sync` step will read that JSON file and perform the copy.

**Roadmap:** We're now working on integrating this feature into the [RushJS](https://rushjs.io) build tool (as part of the upcoming Rush "subspaces" feature). If that is successful, we will then propose to integrate the `pnpm-sync` functionality directly into the official PNPM package manager.  Although subspaces motivate heavier reliance on injected workspaces, the `pnpm-sync` feature does not require Rush subspaces and is useful wherever injected dependencies are needed.

## Published Packages

| Folder | Package | Description |
--- | --- | ---
| [./packages/pnpm-sync](./packages/pnpm-sync/) | [pnpm-sync](https://www.npmjs.com/package/pnpm-sync) | The command-line interface package. Install this package if you want to sync by invoking the `pnpm-sync` shell command. |
| [./packages/pnpm-sync-lib](./packages/pnpm-sync-lib/) | [pnpm-sync-lib](https://www.npmjs.com/package/pnpm-sync-lib)  | The developer API package. Use this package when integrating with a toolchain that will perform syncing automatically. |

## Unpublished Local Projects

| Folder | Description |
| --- | --- |
| [./pnpm-sync-cli-demo](./pnpm-sync-cli-demo/) | Demonstrates usage of the `pnpm-sync` CLI in a workspace project. |
| [./pnpm-sync-api-demo](./pnpm-sync-api-demo/) | Demonstrates usage of the `pnpm-sync` APIs. |

## 💬 Tell us what you think

GitHub issues and pull requests are welcome.  For general discussions about the feature idea, please comment on the upstream GitHub issue:

[(pnpm/pnpm#4407) Injected dependencies are not recopied after a workspace project is rebuilt](https://github.com/pnpm/pnpm/issues/4407)

