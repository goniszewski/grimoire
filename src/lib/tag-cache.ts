import type { QueryClient } from "@tanstack/react-query";
import { bookmarkKeys } from "@/hooks/use-bookmarks";
import type { ApiTag, ApiTagRecord } from "@/lib/api";

export function applyRenamedTagToCache(queryClient: QueryClient, renamedTag: ApiTagRecord): void {
  queryClient.setQueryData<ApiTag[]>(bookmarkKeys.tags, (currentTags) => {
    if (!currentTags) return currentTags;

    return currentTags.map((tag) =>
      tag.id === renamedTag.id
        ? {
            ...tag,
            name: renamedTag.name,
            created_at: renamedTag.created_at,
          }
        : tag
    );
  });
}
