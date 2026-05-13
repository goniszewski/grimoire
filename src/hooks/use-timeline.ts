import { useQuery } from "@tanstack/react-query";
import { listTimeline, ApiTimelineEvent } from "@/lib/api";

export type { ApiTimelineEvent };

export const timelineKeys = {
  all: ["timeline"] as const,
  list: (params: object) => [...timelineKeys.all, "list", params] as const,
};

export function useTimeline(limit = 50, offset = 0) {
  return useQuery({
    queryKey: timelineKeys.list({ limit, offset }),
    queryFn: async () => {
      const response = await listTimeline({ limit, offset });
      return {
        data: response.data as unknown as ApiTimelineEvent[],
        pagination: response.pagination,
      };
    },
    staleTime: 30_000,
  });
}
