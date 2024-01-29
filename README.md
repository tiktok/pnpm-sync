# pnpm-sync

## Background

This repository shows a proof-of-concept implementation of the "pnpm-sync" command that is proposed in the Rush [Subspaces RFC #4230](https://github.com/microsoft/rushstack/issues/4230).<br>
The PNPM package manager installs "injected" dependencies by copying the build output of a local workspace project into one or more symlinked node_modules subfolders. Today PNPM performs this copying only once during the initial "pnpm install", but that is not a complete solution; the output should really be copied whenever the project is rebuilt. The proposed `pnpm-sync` command provides a way to perform this copying after a workspace project is compiled (before its consumers are compiled). The operation is optimized by precomputing the source/target folder locations and storing this information in a new file (`<your-library>/node_modules/.pnpm-sync.json`). In our implementation, `pnpm-sync prepare` writes that JSON file, and `pnpm-sync` reads the JSON file and performs the copy.

### Next steps:

This repo was created to facilitate discussion about the design of the `pnpm-sync` command.
Our next step will be to fully implement this feature in the [RushJS](https://rushjs.io) tool (as part of the upcoming "subspaces" feature).
If that is successful, we will then propose to integrate the `pnpm-sync` functionality directly into the official PNPM package manager.

## Published Packages

Folder | Package | Description
--- | --- | ---
[./packages/pnpm-sync](./packages/pnpm-sync/) | [pnpm-sync](https://www.npmjs.com/package/pnpm-sync)  | The pnpm-sync CLI package. This package is intended to be used where you want to run pnpm-sync as a CLI tool.
[./packages/pnpm-sync-lib](./packages/pnpm-sync-lib/) | [pnpm-sync-lib](https://www.npmjs.com/package/pnpm-sync-lib)  | The pnpm-sync API package. This packaged is intended to be used where you want to integrate the pnpm-sync APIs into your own Monorepo manager tool.

## Unpublished Local Projects
Folder | Description
--- | --- 
[./pnpm-sync-cli-demo](./pnpm-sync-cli-demo/) | This project shows a demo on how to use the pnpm-sync CLI in a workspace project.
[./pnpm-sync-api-demo](./pnpm-sync-api-demo/) | This project shows a demo on how to use the pnpm-sync APIs.

## 💬 Tell us what you think

If you have any questions/suggestions about this feature idea, please comment on the upstream GitHub issue:

[(pnpm/pnpm#4407) Injected dependencies are not recopied after a workspace project is rebuilt](https://github.com/pnpm/pnpm/issues/4407)
