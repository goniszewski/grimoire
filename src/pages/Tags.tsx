import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Hash, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { createTag, deleteTag, listTags, renameTag, type ApiTag } from "@/lib/api";
import { bookmarkKeys } from "@/hooks/use-bookmarks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagRenameDialog } from "@/components/TagRenameDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { MAX_TAG_NAME_LEN, normaliseTagName, validateTagName } from "@/lib/tag-names";
import { applyRenamedTagToCache } from "@/lib/tag-cache";

function bookmarkCountLabel(count: number): string {
  return `${count} bookmark${count === 1 ? "" : "s"}`;
}

const Tags = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tagInput, setTagInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiTag | null>(null);
  const [renameTarget, setRenameTarget] = useState<ApiTag | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  const tagsQuery = useQuery({
    queryKey: bookmarkKeys.tags,
    queryFn: async () => {
      const response = await listTags();
      return response.data;
    },
    staleTime: 30_000,
  });

  const tags = useMemo(() => {
    return [...(tagsQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [tagsQuery.data]);

  function invalidateTagAffectedQueries() {
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.tags });
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.archive });
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.trash });
    queryClient.invalidateQueries({ queryKey: ["search"] });
  }

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await createTag(name);
      return response.data;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.tags });
      setTagInput("");
      setFormError(null);
      toast({ title: "Tag saved", description: `#${response.name}` });
    },
    onError: (error: Error) => {
      setFormError(error.message || "Tag could not be saved.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      const deletedName = deleteTarget?.name;
      invalidateTagAffectedQueries();
      setDeleteTarget(null);
      if (deletedName) toast({ title: "Tag deleted", description: `#${deletedName}` });
    },
    onError: (error: Error) => {
      toast({
        title: "Tag could not be deleted",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await renameTag(id, name);
      return response.data;
    },
    onSuccess: (response) => {
      applyRenamedTagToCache(queryClient, response);
      invalidateTagAffectedQueries();
      setRenameTarget(null);
      setRenameError(null);
      toast({ title: "Tag renamed", description: `#${response.name}` });
    },
    onError: (error: Error) => {
      setRenameError(error.message || "Tag could not be renamed.");
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normaliseTagName(tagInput);
    const validationError = validateTagName(name);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    createMutation.mutate(name);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to library">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Hash className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <h1 className="truncate text-xl font-semibold tracking-tight">Tags</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {tags.length === 0 ? "No tags yet" : `${tags.length} managed tag${tags.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        <form
          onSubmit={handleCreate}
          className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto]"
        >
          <div className="min-w-0 space-y-2">
            <Label htmlFor="tag-name">Tag name</Label>
            <Input
              id="tag-name"
              value={tagInput}
              onChange={(event) => {
                setTagInput(event.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="typescript"
              maxLength={MAX_TAG_NAME_LEN + 8}
              aria-invalid={!!formError}
              aria-describedby={formError ? "tag-name-error" : undefined}
            />
            {formError && (
              <p id="tag-name-error" className="text-xs text-destructive">
                {formError}
              </p>
            )}
          </div>
          <Button type="submit" className="self-end" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create tag
          </Button>
        </form>

        {tagsQuery.isLoading && (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading tags...
          </div>
        )}

        {tagsQuery.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Tags unavailable
          </div>
        )}

        {!tagsQuery.isLoading && !tagsQuery.isError && tags.length === 0 && (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
            <Hash className="mb-3 h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
            <h2 className="text-sm font-medium">No tags yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Create one here or add tags from a bookmark detail view.
            </p>
          </div>
        )}

        {!tagsQuery.isLoading && !tagsQuery.isError && tags.length > 0 && (
          <div className="grid gap-2">
            {tags.map((tag) => (
              <article
                key={tag.id}
                className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="secondary" className="h-6 px-2 font-mono text-xs">
                      {tag.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{bookmarkCountLabel(tag.bookmark_count)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/tags/${encodeURIComponent(tag.name)}`} aria-label={`Open #${tag.name} tag`}>
                      <Search className="h-3.5 w-3.5" />
                      View
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setRenameTarget(tag);
                      setRenameError(null);
                    }}
                    aria-label={`Rename ${tag.name} tag`}
                    title={`Rename ${tag.name} tag`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(tag)}
                    aria-label={`Delete ${tag.name} tag`}
                    title={`Delete ${tag.name} tag`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete #{deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the tag from {bookmarkCountLabel(deleteTarget?.bookmark_count ?? 0)} in the active
              library. Archived or trashed bookmarks using it are detached too. Bookmarks are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              Delete tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TagRenameDialog
        tag={renameTarget}
        open={!!renameTarget}
        error={renameError}
        pending={renameMutation.isPending}
        onClearError={() => setRenameError(null)}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            setRenameError(null);
          }
        }}
        onSubmit={(name) => {
          if (!renameTarget) return;
          setRenameError(null);
          renameMutation.mutate({ id: renameTarget.id, name });
        }}
      />
    </div>
  );
};

export default Tags;
