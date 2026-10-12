# Browslatro

## MCP harness control

This fork adds standard MCP Streamable HTTP and stdio access so your own harness can observe and control the browser game. The game does not call your model or run an agent loop. Click **Enable MCP control** in a browser, then connect your harness to the production server's `/mcp` endpoint or the local stdio adapter. See [MCP setup and tool reference](docs/mcp-harness.md) and [cluster deployment](docs/cluster-deployment.md).

A slimmed-down React + TypeScript implementation of the popular poker game, Balatro. Built with [Vite](https://vitejs.dev/), [Vitest](https://vitest.dev/), and [Playwright](https://playwright.dev/).

## Package manager

This project uses [Yarn 4 (Berry)](https://yarnpkg.com/) (pinned via the `packageManager` field in `package.json`) with the node-modules linker. Node.js 24+ is required for the TypeScript MCP server. The linker avoids cross-drive hardlink issues on Windows.

Activate the pinned version through Corepack, then install:

```sh
corepack enable
yarn install
```

Corepack ships with Node.js and reads `packageManager` from `package.json` to pick the right Yarn version automatically — the release binary is committed to `.yarn/releases/`, so no network call is needed to bootstrap Yarn itself.

### Worktrees

Each checkout installs its own `node_modules/` using Yarn's cache:

```sh
git worktree add ../some-branch some-branch
cd ../some-branch
yarn install   # near-instant under PnP
```

## Available Scripts

In the project directory, you can run:

### `yarn start`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000) with Vite's HMR.

### `yarn test`

Runs the Vitest unit test suite once. Use `yarn test:watch` for the interactive watch mode.

### `yarn build`

Type-checks with `tsc` and produces an optimized production bundle in `build/`.

### `yarn preview`

Serves the production build locally for smoke-testing the bundle.

### `yarn e2e`

Builds the app, boots `vite preview`, and runs the Playwright end-to-end suite against it.

### `yarn typecheck`

Runs `tsc --noEmit` without building.

### `yarn storybook`

Starts [Storybook](https://storybook.js.org/) at [http://localhost:6006](http://localhost:6006). Every component under `src/components/` has co-located `*.stories.tsx` covering its visual states; shared story utilities (the `withGame` store-seeding decorator and card fixtures) live in `src/stories/`.

### `yarn build-storybook`

Builds the static Storybook site into `storybook-static/`.
