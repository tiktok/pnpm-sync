# pnpm-sync-api-demo

Here, we will show examples on how to use pnpm-sync APIs. The APIs mainly used where you want to integrate pnpm-sync into your own Monorepo management tools. 

## Folder structure

We will use some test cases to demonstrate how to consume the APIs from `pnpm-sync-lib`.

The main app to drive the test cases is under `pnpm-sync-api-demo` folder. All test cases are under `pnpm-sync-api-demo/src/test` folder.

There are some sample apps and libs under `pnpm-sync-api-demo/text-fixtures` to be used by the test cases. 

## Instructions

### 1. Run `pnpm install` to install all dependencies

You can check `node_modules` folder under each app. By default, there is no `.pnpm-sync.json` file. 

### 2. Run `pnpm run build && pnpm run test` under `pnpm-sync-api-demo`

There will be some messages on the console about the test cases calling APIs from `pnpm-sync-lib`.

