import { useQuery } from "@tanstack/react-query";
import { checkHealth } from "@/lib/api";

/**
 * Polls daemon health every 10 seconds.
 * Returns { online: boolean, isChecking: boolean }.
 */
export function useDaemonStatus() {
  const { data: online = false, isFetching } = useQuery({
    queryKey: ["daemon-health"],
    queryFn: checkHealth,
    refetchInterval: 10_000,
    staleTime: 9_000,
    retry: false,
  });

  return { online, isChecking: isFetching };
}
