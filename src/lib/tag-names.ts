export const MAX_TAG_NAME_LEN = 50;

const TAG_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function normaliseTagName(value: string): string {
  return value.trim().toLowerCase();
}

export function validateTagName(name: string): string | null {
  if (!name) return "Enter a tag name.";
  if (name.length > MAX_TAG_NAME_LEN) return `Tag names must be ${MAX_TAG_NAME_LEN} characters or fewer.`;
  if (!TAG_NAME_PATTERN.test(name)) {
    return "Use lowercase letters, digits, and single hyphens without spaces.";
  }
  return null;
}
