import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  ApiSuggestion,
} from "@/lib/api";

export type { ApiSuggestion };

export const suggestionKeys = {
  all: ["suggestions"] as const,
  pending: () => [...suggestionKeys.all, "pending"] as const,
};

function removeSuggestionById(suggestions: ApiSuggestion[], id: string): ApiSuggestion[] {
  return (suggestions as Array<{ id: string }>).filter((suggestion) => suggestion.id !== id) as ApiSuggestion[];
}

export function useSuggestions() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: suggestionKeys.pending(),
    queryFn: listSuggestions,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const pendingCount = query.data?.meta.pending ?? 0;
  const suggestions = (query.data?.data ?? []) as unknown as ApiSuggestion[];

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptSuggestion(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: suggestionKeys.pending() });
      const previous = qc.getQueryData<{ data: ApiSuggestion[]; meta: { pending: number } }>(
        suggestionKeys.pending()
      );
      // Optimistic: remove suggestion from list immediately
      if (previous) {
        qc.setQueryData(suggestionKeys.pending(), {
          ...previous,
          data: removeSuggestionById(previous.data, id),
          meta: { pending: Math.max(0, previous.meta.pending - 1) },
        });
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(suggestionKeys.pending(), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: suggestionKeys.pending() });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectSuggestion(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: suggestionKeys.pending() });
      const previous = qc.getQueryData<{ data: ApiSuggestion[]; meta: { pending: number } }>(
        suggestionKeys.pending()
      );
      if (previous) {
        qc.setQueryData(suggestionKeys.pending(), {
          ...previous,
          data: removeSuggestionById(previous.data, id),
          meta: { pending: Math.max(0, previous.meta.pending - 1) },
        });
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(suggestionKeys.pending(), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: suggestionKeys.pending() });
    },
  });

  return {
    suggestions,
    pendingCount,
    isLoading: query.isLoading,
    isError: query.isError,
    accept: (id: string) => acceptMutation.mutate(id),
    reject: (id: string) => rejectMutation.mutate(id),
  };
}
