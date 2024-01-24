# Setting your machine

1. Install a LTS Node.js version, such as v20.11.0
2. Install rush globally: `npm install -g @microsoft/rush`
3. Clone the repository: `git clone git@github.com:tiktok/pnpm-sync.git`

# Building the project

We use Rush tool for building projects in this monorepo.

1. Use rush to install the package dependencies:

```
rush install
```

2. Build the project in the repo:

```
# rush build
```

# Submitting a Pull Request

We welcome contributions! To submit a feature:

1. Fork the repo.
2. Create a branch and commit your changes.
3. If you modify any package.json files, run `rush update` to make sure the `pnpm-lock.yaml` file is up to date. Commit any changes made to that file.
5. Create a pull request.