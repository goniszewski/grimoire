import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";

export const settingsKeys = {
  all: ["settings"] as const,
};

export function useSettings() {
  const query = useQuery({
    queryKey: settingsKeys.all,
    queryFn: getSettings,
    staleTime: 60_000,
    retry: 1,
  });

  const aiProvider = query.data?.data?.ai?.provider ?? null;
  const aiEnabled = aiProvider !== null && aiProvider !== "none";

  return {
    settings: query.data?.data ?? null,
    aiProvider,
    aiEnabled,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
