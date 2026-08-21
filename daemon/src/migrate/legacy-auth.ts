import { LegacyAuthError, LegacySourceError } from "./legacy-errors.js";
import type { LegacyBackupContents, LegacyUser } from "./legacy-types.js";

export { LegacyAuthError };

export function findLegacyOwner(
  contents: LegacyBackupContents,
  ownerQuery: string | undefined
): LegacyUser {
  if (contents.users.length === 0) {
    throw new LegacySourceError("v0.5 database contains no users to migrate");
  }

  if (!ownerQuery || !ownerQuery.trim()) {
    if (contents.users.length === 1) return contents.users[0];
    throw new LegacySourceError(
      "v0.5 database contains multiple users. Pass --owner <username|email|id> to select one."
    );
  }

  const query = ownerQuery.trim().toLowerCase();
  const matches = contents.users.filter((user) => {
    return (
      String(user.id) === query ||
      user.username.toLowerCase() === query ||
      user.email.toLowerCase() === query
    );
  });

  if (matches.length === 0) {
    throw new LegacySourceError(
      `No v0.5 user matched "${ownerQuery}". Use migrate inspect to list owners.`
    );
  }
  if (matches.length > 1) {
    throw new LegacySourceError(
      `Owner query "${ownerQuery}" matched multiple users; use a unique username, email, or id.`
    );
  }
  return matches[0];
}

/**
 * Verify a password against the v0.5 user.password_hash (Lucia/argon2 or bcrypt).
 * Ownership proof only — does not create Grimoire 1.x accounts.
 */
export async function verifyLegacyOwnerPassword(
  user: LegacyUser,
  password: string
): Promise<void> {
  if (!password) {
    throw new LegacyAuthError("Password is required for owner verification");
  }
  if (!user.passwordHash) {
    throw new LegacyAuthError(
      `v0.5 user "${user.username}" has no password hash; cannot verify ownership`
    );
  }

  let ok = false;
  try {
    ok = await Bun.password.verify(password, user.passwordHash);
  } catch {
    ok = false;
  }

  if (!ok) {
    throw new LegacyAuthError(`Password does not match v0.5 user "${user.username}"`);
  }
}
