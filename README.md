# pnpm-sync

## Background

This repository shows a proof-of-concept implementation of the "pnpm-sync" command that is proposed in the Rush [Subspaces RFC #4230](https://github.com/microsoft/rushstack/issues/4230).<br>
The PNPM package manager installs "injected" dependencies by copying the build output of a local workspace project into one or more symlinked node_modules subfolders. Today PNPM performs this copying only once during the initial "pnpm install", but that is not a complete solution; the output should really be copied whenever the project is rebuilt. The proposed `pnpm-sync` command provides a way to perform this copying after a workspace project is compiled (before its consumers are compiled). The operation is optimized by precomputing the source/target folder locations and storing this information in a new file (`<your-library>/node_modules/.pnpm-sync.json`). In our implementation, `pnpm-sync --prepare` writes that JSON file, and `pnpm-sync` reads the JSON file and performs the copy.

### Next steps:

This prototype was created to facilitate discussion about the design of the `pnpm-sync` command.
Our next step will be to fully implement this feature in the [RushJS](https://rushjs.io) tool (as part of the upcoming "subspaces" feature).
If that is successful, we will then propose to integrate the `pnpm-sync` functionality directly into the official PNPM package manager.

## Folder structure

This demo repo is built with rush. We set up few sample apps and libs to mimic the situation.<br>
Under `apps` folder, we have three apps, `app1 and app2` have an injected workspace dependency `lib1`, `app3` has a normal workspace dependency `lib1`.<br>
The package.json for `app1 and app2`

```
{
  "dependencies": {
    "lib1": "workspace:*"
  },
  "dependenciesMeta": {
    "lib1": {
      "injected": true
    }
  },
}
```

The package.json for `app3`

```
{
  "dependencies": {
    "lib1": "workspace:*"
  }
}
```

Under `libraries` folder, the `lib1` is the sample lib used by apps.

## Instructions

### 1. Run `rush install` to install all dependencies

You can check node_modules folder under each app to see the installation difference for injected dependencies and normal dependencies.<br>
For projects have the injected workspace dependency `lib1`, the `lib1` will link to pnpm store.
```
lib1 -> ../../../common/temp/node_modules/.pnpm/file+..+..+libraries+lib1_react@16.0.0_vue@3.3.13/node_modules/lib1
```
For projects have the normal workspace dependency `lib1`, the `lib1` will link to the source code.
```
lib1 -> ../../../libraries/lib1
```

### 2. Run `rush after-install` to generate the `pnpm-sync.json` file.

This command will call `pnpm-sync prepare` eventually.<br>

You can check `node_modules` folder under `lib1`, you will the `pnpm-sync.json` file, like below:

```
{
  "postbuildInjectedCopy": {
    "sourceFolder": "../..",
    "targetFolders": [
      {
        "folderPath": "../../../../common/temp/node_modules/.pnpm/file+..+..+libraries+lib1_react@16.0.0/node_modules/lib1"
      },
      {
        "folderPath": "../../../../common/temp/node_modules/.pnpm/file+..+..+libraries+lib1_react@16.9.0/node_modules/lib1"
      }
    ]
  }
}
```

This awkward extra step of `rush after-install` is to simplify the prototype, the "pnpm-sync" source code is in the same workspace as the test projects.<br>
Long term, the `pnpm-sync` prototype will be published as an NPM package, and we propose to integrate it directly into the "pnpm" project.

### 3. Rush `rush build` to build the project

If you check build script for `lib1`, you will see that it will execute `pnpm-sync` after project compiled. The `pnpm-sync` command will copy the build output to the target folders based on the `pnpm-sync.json` file we generated previously.

```
{
  "scripts": {
    "build": "tsc && pnpm-sync"
  }
}
```

## 💬 Tell us what you think

If you have any questions/suggestions about this feature idea, please comment on the upstream GitHub issue:

[(pnpm/pnpm#4407) Injected dependencies are not recopied after a workspace project is rebuilt](https://github.com/pnpm/pnpm/issues/4407)
