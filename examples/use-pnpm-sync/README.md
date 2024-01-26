# use-pnpm-sync

Here, we will show an example on how to use `pnpm-sync` in a workspace scenario. 

## Folder structure

We set up few sample apps and libs to mimic the situation.<br>
we have two apps, `app1` has an injected workspace dependency `lib1`, `app2` has a normal workspace dependency `lib1`.<br>
The package.json for `app1`

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

The package.json for `app2`

```
{
  "dependencies": {
    "lib1": "workspace:*"
  }
}
```


## Instructions

### 1. Install `pnpm-sync` tool

```
pnpm install pnpm-sync@latest -g
```

### 2. Run `pnpm install` to install all dependencies

You can check `node_modules` folder under each app to see the installation difference for injected dependencies and normal dependencies.<br>
For projects have the injected workspace dependency `lib1`, the `lib1` will link to pnpm store.
```
lib1 -> ../../../../node_modules/.pnpm/file+examples+use-pnpm-sync+lib1_@types+node@20.11.6_react@17.0.2/node_modules/lib1
```
For projects have the normal workspace dependency `lib1`, the `lib1` will link to the source code.
```
lib1 -> ../../lib1
```

### 3. Run `pnpm-sync prepare` to generate the `pnpm-sync.json` file.

The `pnpm-sync prepare` command takes two required arguments, the `pnpm-lock.yaml` file path and `.pnpm` folder path.<br> 
Assuming you are under `examples/use-pnpm-sync` folder, then in this example, the command will be:
```
pnpm-sync prepare --lockfile=../../pnpm-lock.yaml --store=../../node_modules/.pnpm
```
After run this command, you can check `node_modules` folder under lib1, you will the `pnpm-sync.json` file, like below:
```
{
  "postbuildInjectedCopy": {
    "sourceFolder": "../..",
    "targetFolders": [
      {
        "folderPath": "../../../../../node_modules/.pnpm/file+examples+use-pnpm-sync+lib1_@types+node@20.11.6_react@17.0.2/node_modules/lib1"
      }
    ]
  }
}
```

### 4. Run `pnpm-sync` for injected workspace dependency `lib1`

Since `app1` sets `lib1` as the injected workspace dependency, now, every time after `lib1` re-build, its build output needs to be copied to the corresponding `pnpm-store` location.<br>
To achieve that, you can simply run `pnpm-sync` under `lib1` folder. <br>
After that, the build output of `lib1` are copied to the corresponding `pnpm-store` properly. 

