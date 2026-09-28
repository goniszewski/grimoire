export type ReleasePlatform = "macos" | "linux";

/** Published releases through 1.3.0 retain their original download names. */
export function releaseArchiveFileName(version: string, platform: ReleasePlatform): string {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.+-]+)?$/.exec(version);
  if (!match) throw new Error(`Unsupported release version: ${version}`);
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  const isAfterRename = major > 1 || (major === 1 && (minor > 3 || (minor === 3 && patch > 0)));
  return `${isAfterRename ? "grimoire" : "little-imp"}-${version}-${platform}.tar.gz`;
}
