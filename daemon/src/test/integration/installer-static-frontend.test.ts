import { describe, expect, it } from "bun:test";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const daemonRoot = join(import.meta.dir, "../../..");

async function writeExecutable(path: string, content: string): Promise<void> {
  await writeFile(path, content);
  await chmod(path, 0o755);
}

type FixtureRepoOptions = {
  frontend: "source" | "prebuilt" | "missing";
  disableRsync?: boolean;
  prepareHome?: (homeDir: string) => Promise<void>;
};

async function createFixtureRepo(root: string, options: FixtureRepoOptions): Promise<string> {
  const fixtureRepo = join(root, "repo");
  const fixtureDaemon = join(fixtureRepo, "daemon");

  await mkdir(join(fixtureDaemon, "platform"), { recursive: true });
  await mkdir(join(fixtureDaemon, "src"), { recursive: true });
  await cp(join(daemonRoot, "install.sh"), join(fixtureDaemon, "install.sh"));
  await cp(
    join(daemonRoot, "platform", "littleimp.service"),
    join(fixtureDaemon, "platform", "littleimp.service")
  );
  await cp(
    join(daemonRoot, "platform", "com.littleimp.daemon.plist"),
    join(fixtureDaemon, "platform", "com.littleimp.daemon.plist")
  );

  if (options.frontend === "source") {
    await mkdir(join(fixtureRepo, "src"), { recursive: true });
    await writeFile(join(fixtureRepo, "package.json"), JSON.stringify({ scripts: { build: "vite build" } }));
    await writeFile(join(fixtureRepo, "index.html"), '<div id="root"></div>\n');
    await writeFile(join(fixtureRepo, "src", "main.tsx"), "console.log('frontend');\n");
  } else if (options.frontend === "prebuilt") {
    await mkdir(join(fixtureRepo, "dist", "assets"), { recursive: true });
    await writeFile(
      join(fixtureRepo, "dist", "index.html"),
      "<!doctype html><html><head><title>Prebuilt Little Imp</title></head><body></body></html>"
    );
    await writeFile(join(fixtureRepo, "dist", "assets", "app.js"), 'console.log("prebuilt");');
  }

  await writeFile(join(fixtureDaemon, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(join(fixtureDaemon, "src", "cli.ts"), "console.log('cli');\n");
  await writeFile(join(fixtureDaemon, "src", "index.ts"), "console.log('daemon');\n");

  return fixtureRepo;
}

async function createFakePath(root: string): Promise<string> {
  const binDir = join(root, "bin");
  await mkdir(binDir, { recursive: true });

  await writeExecutable(
    join(binDir, "bun"),
    `#!/usr/bin/env bash
set -euo pipefail
case "\${1:-}" in
  --version)
    printf '1.2.3\\n'
    ;;
  install)
    ;;
  run)
    if [[ "\${2:-}" == "build" ]]; then
      mkdir -p dist/assets
      printf '<!doctype html><html><head><title>Little Imp</title></head><body><div id="root"></div></body></html>' > dist/index.html
      printf 'console.log("little imp");' > dist/assets/app.js
    fi
    ;;
  *)
    printf 'unexpected bun invocation: %s\\n' "$*" >&2
    exit 2
    ;;
esac
`
  );

  await writeExecutable(
    join(binDir, "curl"),
    `#!/usr/bin/env bash
printf '{"status":"ok"}\\n'
`
  );
  await writeExecutable(join(binDir, "systemctl"), "#!/usr/bin/env bash\nexit 0\n");
  await writeExecutable(join(binDir, "uname"), "#!/usr/bin/env bash\nprintf 'Linux\\n'\n");

  return binDir;
}

async function runInstallerFixture(options: FixtureRepoOptions): Promise<{
  homeDir: string;
  stdout: string;
  stderr: string;
  tempRoot: string;
}> {
  const tempRoot = await mkdtemp(join(tmpdir(), "little-imp-install-test-"));

  try {
    const fixtureRepo = await createFixtureRepo(tempRoot, options);
    const homeDir = join(tempRoot, "home");
    await mkdir(homeDir, { recursive: true });
    await options.prepareHome?.(homeDir);
    const fakePath = await createFakePath(tempRoot);
    const bashEnv = options.disableRsync ? join(tempRoot, "no-rsync.bashenv") : undefined;

    if (bashEnv) {
      await writeFile(
        bashEnv,
        `command() {
  if [[ "\${1:-}" == "-v" && "\${2:-}" == "rsync" ]]; then
    return 1
  fi
  builtin command "$@"
}
`
      );
    }

    const proc = Bun.spawn({
      cmd: ["bash", join(fixtureRepo, "daemon", "install.sh")],
      cwd: join(fixtureRepo, "daemon"),
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${fakePath}:${process.env.PATH ?? ""}`,
        ...(bashEnv ? { BASH_ENV: bashEnv } : {}),
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    expect(exitCode, `${stdout}\n${stderr}`).toBe(0);

    return { homeDir, stdout, stderr, tempRoot };
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

describe("install.sh static frontend install", () => {
  it("builds and installs the frontend where the daemon serves static assets from", async () => {
    const result = await runInstallerFixture({ frontend: "source" });

    try {
      const installedDist = join(result.homeDir, ".local", "share", "littleimp", "dist");
      expect(existsSync(join(installedDist, "index.html"))).toBe(true);
      expect(existsSync(join(installedDist, "assets", "app.js"))).toBe(true);
      await expect(readFile(join(installedDist, "index.html"), "utf8")).resolves.toContain(
        "<title>Little Imp</title>"
      );
    } finally {
      await rm(result.tempRoot, { recursive: true, force: true });
    }
  });

  it("installs a prebuilt frontend bundle without rebuilding it", async () => {
    const result = await runInstallerFixture({ frontend: "prebuilt" });

    try {
      const installedDist = join(result.homeDir, ".local", "share", "littleimp", "dist");
      expect(result.stdout).toContain("Using existing frontend bundle");
      expect(result.stdout).not.toContain("Building frontend bundle");
      expect(existsSync(join(installedDist, "index.html"))).toBe(true);
      expect(existsSync(join(installedDist, "assets", "app.js"))).toBe(true);
      await expect(readFile(join(installedDist, "index.html"), "utf8")).resolves.toContain(
        "<title>Prebuilt Little Imp</title>"
      );
    } finally {
      await rm(result.tempRoot, { recursive: true, force: true });
    }
  });

  it("removes stale installed frontend files when no source or bundle exists", async () => {
    const result = await runInstallerFixture({
      frontend: "missing",
      prepareHome: async (homeDir) => {
        const installedDist = join(homeDir, ".local", "share", "littleimp", "dist");
        await mkdir(join(installedDist, "assets"), { recursive: true });
        await writeFile(
          join(installedDist, "index.html"),
          "<!doctype html><html><head><title>Stale Little Imp</title></head><body></body></html>"
        );
        await writeFile(join(installedDist, "assets", "stale.js"), 'console.log("stale");');
      },
    });

    try {
      const installedDist = join(result.homeDir, ".local", "share", "littleimp", "dist");
      expect(result.stdout).toContain("Frontend source/bundle not found");
      expect(result.stdout).toContain("Removing stale frontend files");
      expect(result.stdout).toContain("UI:     not installed");
      expect(existsSync(join(installedDist, "index.html"))).toBe(false);
      expect(existsSync(join(installedDist, "assets", "stale.js"))).toBe(false);
    } finally {
      await rm(result.tempRoot, { recursive: true, force: true });
    }
  });

  it("mirrors frontend files when rsync is unavailable", async () => {
    const result = await runInstallerFixture({
      frontend: "source",
      disableRsync: true,
      prepareHome: async (homeDir) => {
        const installedAssets = join(homeDir, ".local", "share", "littleimp", "dist", "assets");
        await mkdir(installedAssets, { recursive: true });
        await writeFile(join(installedAssets, "stale.js"), 'console.log("stale");');
      },
    });

    try {
      const installedDist = join(result.homeDir, ".local", "share", "littleimp", "dist");
      expect(result.stdout).toContain("Building frontend bundle");
      expect(existsSync(join(installedDist, "index.html"))).toBe(true);
      expect(existsSync(join(installedDist, "assets", "app.js"))).toBe(true);
      expect(existsSync(join(installedDist, "assets", "stale.js"))).toBe(false);
    } finally {
      await rm(result.tempRoot, { recursive: true, force: true });
    }
  });
});
