import { basename, join } from "path";

export function restartCommandForPlatform(platform: NodeJS.Platform = process.platform): string {
  if (platform === "darwin") {
    return "launchctl stop com.littleimp.daemon && launchctl start com.littleimp.daemon";
  }
  if (platform === "linux") {
    return "systemctl --user restart littleimpd";
  }
  return "restart littleimpd with your platform service manager";
}

export function localHealthUrl(host: string, port: number): string {
  const trimmedHost = host.trim();
  const reachableHost = trimmedHost === "" || trimmedHost === "0.0.0.0" || trimmedHost === "::"
    ? "127.0.0.1"
    : trimmedHost;
  const urlHost = reachableHost.includes(":") && !reachableHost.startsWith("[")
    ? `[${reachableHost}]`
    : reachableHost;
  return `http://${urlHost}:${port}/health`;
}

export function rollbackInstructions(
  rollbackPath: string,
  dbPath: string,
  restartCommand: string
): string[] {
  const rollbackDbPath = join(rollbackPath, basename(dbPath));
  return [
    "If the restored library is not correct, stop littleimpd before rolling back.",
    `Copy ${rollbackDbPath} back to ${dbPath}.`,
    `Restart littleimpd again with: ${restartCommand}.`,
  ];
}
