import { version as PACKAGE_VERSION } from "../../../package.json";

/**
 * A release that is always newer than the running package, so update-check
 * tests keep working as the package version moves (1.4.0 -> 1.5.0, ...).
 */
const [major, minor] = PACKAGE_VERSION.split(".").map(Number);
export const NEWER_VERSION = `${major}.${minor + 1}.0`;

const RELEASE_URL = "https://github.com/goniszewski/grimoire/releases/tag";

/** GitHub-style release list: a stable release plus a newer-looking beta that must be ignored on stable. */
export function newerReleaseFixtures(publishedAt: { beta: string; stable: string }) {
  return [
    {
      tag_name: `v${NEWER_VERSION}-beta.1`,
      name: `Grimoire ${NEWER_VERSION} beta 1`,
      draft: false,
      prerelease: true,
      published_at: publishedAt.beta,
      html_url: `${RELEASE_URL}/v${NEWER_VERSION}-beta.1`,
    },
    {
      tag_name: `v${NEWER_VERSION}`,
      name: `Grimoire ${NEWER_VERSION}`,
      draft: false,
      prerelease: false,
      published_at: publishedAt.stable,
      html_url: `${RELEASE_URL}/v${NEWER_VERSION}`,
    },
  ];
}

/** The `latest` object the update check should report for the stable release above. */
export function expectedNewerRelease(publishedAt: string) {
  return {
    version: NEWER_VERSION,
    tag: `v${NEWER_VERSION}`,
    name: `Grimoire ${NEWER_VERSION}`,
    prerelease: false,
    published_at: publishedAt,
    url: `${RELEASE_URL}/v${NEWER_VERSION}`,
  };
}
