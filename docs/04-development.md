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

Homebrew-specific validation requires Homebrew and performs a disposable
install through a local tap:

```sh
npm run test:homebrew
```

The public tap uses this same repository:

```sh
brew tap goniszewski/grimoire https://github.com/goniszewski/grimoire.git
brew trust --formula goniszewski/grimoire/grimoire
```

`npm run test:homebrew:published` checks that public path, including an online
formula audit. Run on a disposable host with no existing Grimoire Homebrew
installation or data. The smoke verifies CLI aliases, exact service version,
reinstall preservation of the database/configuration, restart, and explicit
uninstall preservation. It removes test-created data afterward.

The script isolates runtime settings and Homebrew trust using a temporary
configuration directory. `HOMEBREW_TEST_PORT=13210` selects another loopback
port using [Homebrew service environment overrides](https://docs.brew.sh/Manpage#services-subcommand), so an existing native
daemon can keep running. This requires a Homebrew version supporting service
environment files; the default port remains 3210.

For pre-publication testing, download and verify the signed release archives
first, then provide their directory in local mode. Homebrew verifies the
formula SHA-256 against the supplied archive; this does not prove public
asset availability:

```sh
HOMEBREW_TEST_ARCHIVE_DIR=/absolute/path/to/verified-archives \
HOMEBREW_TEST_EXPECTED_VERSION=1.2.0 \
HOMEBREW_TEST_PORT=13210 npm run test:homebrew
```

For an actual upgrade, also set
`HOMEBREW_TEST_UPGRADE_FROM_FORMULA=/absolute/path/to/v1.1.0/grimoire.rb`.
The script installs that older formula, starts and stops the service, then
copies the working-tree formula into the test tap and runs `brew upgrade`.
A saved bookmark and edited `.env` are checked after restart and uninstall.
It requires the version to change and verifies preservation and service health
at the requested target version. Supply both archives when using local cache
mode. Without the older formula, the test exercises a same-version reinstall.

For the v1.2 release:

1. Keep `Formula/grimoire.rb` and the tracked `Formula/release.json` aligned
   with the final signed artifacts. The prepared pins identify the verified
   v1.2.0 candidate; if any archive changes, repeat verification and update
   both files. Formula version checks are independent of the source branch's
   package version and ignored local build output.
2. Publish the reviewed formula to the public repository's default branch
   and publish the matching release assets. No separate tap repository is
   needed. These are release actions, separate from local preparation.
3. Run `HOMEBREW_TEST_EXPECTED_VERSION=1.2.0 npm run test:homebrew:published`
   on clean macOS and Linux Homebrew hosts. Record the public URL/download,
   service health, and data-preservation results before declaring support.

Local mode copies the current working-tree formula into its disposable tap,
so uncommitted formula edits are included. Archive URLs determine the release
installed; it does not build the current source checkout.

If tooling is missing in a constrained environment:

```sh
npm run tools:setup
export PATH="$PWD/local/bin:$PATH"
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution expectations.
