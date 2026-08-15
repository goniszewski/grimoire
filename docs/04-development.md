# Development

Run the React UI and the Bun daemon from a source checkout.

## Prerequisites

- Node.js + npm (frontend)
- [Bun](https://bun.sh/docs/installation) 1.x (daemon)

## Setup

```sh
git clone https://github.com/goniszewski/grimoire.git
cd grimoire

npm install
cd daemon && bun install
cd ..
```

## Run

**Terminal 1 — start the daemon first** and wait until it answers health checks:

```sh
npm run daemon:dev
curl http://127.0.0.1:3210/health
```

**Terminal 2 — then start the UI:**

```sh
npm run dev
```

- UI: [http://127.0.0.1:8080](http://127.0.0.1:8080) (talks to the daemon on `3210`)
- Daemon: [http://127.0.0.1:3210](http://127.0.0.1:3210)

If only the Vite app is running, the UI will look dead until the daemon is up.

## Useful commands

```sh
npm run lint
npm run type-check
npm run test
npm run test:daemon
npm run test:e2e
npm run build
npm run check
```

If tooling is missing in a constrained environment:

```sh
npm run tools:setup
export PATH="$PWD/local/bin:$PATH"
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution expectations.
