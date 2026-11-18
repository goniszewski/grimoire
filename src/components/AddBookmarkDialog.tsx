import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { isSafeExternalBookmarkUrl } from "@/lib/safe-url";
import { toast } from "@/hooks/use-toast";
import type { SharePrefill } from "@/lib/share-link";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import {
  clearDraft,
  isNewBookmarkDraft,
  isNewBookmarkDraftEmpty,
  loadDraft,
  newBookmarkDraftKey,
  saveDraft,
  type NewBookmarkDraft,
} from "@/lib/draft-storage";

interface AddBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (
    url: string,
    options?: { readLater?: boolean; notes?: string; title?: string; tags?: string[] },
  ) => Promise<void> | void;
  /** Values from a share link; take precedence over a stored draft. */
  prefill?: SharePrefill | null;
}

function parseTagInput(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

export function AddBookmarkDialog({ open, onOpenChange, onAdd, prefill }: AddBookmarkDialogProps) {
  const [urls, setUrls] = useState("");
  const [readLater, setReadLater] = useState(false);
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [failureDetails, setFailureDetails] = useState<{ url: string; reason: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const draft: NewBookmarkDraft = { urls, title, notes, tags, readLater };

  // On open: a share link prefill wins; otherwise restore any unsaved draft.
  useEffect(() => {
    if (!open) {
      setDraftReady(false);
      return;
    }
    if (prefill) {
      setUrls(prefill.url);
      setTitle(prefill.title);
      setNotes(prefill.notes);
      setTags(prefill.tags.join(", "));
      setRestoredDraft(false);
    } else {
      const stored = loadDraft(newBookmarkDraftKey, isNewBookmarkDraft);
      if (stored && !isNewBookmarkDraftEmpty(stored)) {
        setUrls(stored.urls);
        setTitle(stored.title);
        setNotes(stored.notes);
        setTags(stored.tags);
        setReadLater(stored.readLater);
        setRestoredDraft(true);
      }
    }
    setDraftReady(true);
  }, [open, prefill]);

  useDraftAutosave(newBookmarkDraftKey, draft, {
    active: open && draftReady,
    isEmpty: isNewBookmarkDraftEmpty,
  });

  const resetForm = useCallback(() => {
    setUrls("");
    setNotes("");
    setTitle("");
    setTags("");
    setReadLater(false);
    setRestoredDraft(false);
  }, []);

  const discardDraft = () => {
    clearDraft(newBookmarkDraftKey);
    resetForm();
  };

  // Closing by Escape/overlay keeps the draft (flushed now so the debounce cannot lose it).
  const handleOpenChange = (next: boolean) => {
    if (!next && !isNewBookmarkDraftEmpty(draft)) saveDraft(newBookmarkDraftKey, draft);
    onOpenChange(next);
  };

  const handleCancel = () => {
    discardDraft();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = urls.split(/[\s]+/).map((value) => value.trim()).filter(Boolean);
    if (items.length === 0 || items.length > 500) {
      setError("Enter 1–500 URLs, one per line.");
      return;
    }
    if (items.length === 1 && !isSafeExternalBookmarkUrl(items[0])) {
      setError("Please enter a valid URL (http or https, no credentials).");
      return;
    }
    setSubmitting(true);
    setError("");
    setResult("");
    setFailureDetails([]);
    try {
      let saved = 0;
      const failed: { url: string; reason: string }[] = [];
      for (const url of [...new Set(items)]) {
        if (!isSafeExternalBookmarkUrl(url)) {
          failed.push({ url, reason: "Invalid URL (http or https, no credentials)." });
          continue;
        }
        try {
          await onAdd(url, {
            readLater,
            ...(items.length === 1 && notes.trim() ? { notes: notes.trim() } : {}),
            ...(items.length === 1 && title.trim() ? { title: title.trim() } : {}),
            ...(items.length === 1 && parseTagInput(tags).length > 0 ? { tags: parseTagInput(tags) } : {}),
          });
          saved += 1;
        } catch (caught) {
          failed.push({ url, reason: caught instanceof Error ? caught.message : "Could not save this URL." });
        }
      }
      if (failed.length > 0) {
        setUrls(failed.map(({ url }) => url).join("\n"));
        if (items.length === 1) setError(failed[0].reason);
        else {
          setResult(`${saved} saved · ${failed.length} failed. Only failed URLs remain for retry.`);
          setFailureDetails(failed);
        }
      } else {
        clearDraft(newBookmarkDraftKey);
        resetForm();
        const confirmation = `${saved} saved to Grimoire${readLater ? " and added to Later" : ""}. You can close the original tabs.`;
        if (items.length === 1) {
          toast({ title: "Bookmark saved", description: confirmation });
          onOpenChange(false);
        } else {
          setResult(confirmation);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Bookmark
          </DialogTitle>
          <DialogDescription>
            Paste one URL or a list of URLs. Saving is confirmed before you close the original tabs.
          </DialogDescription>
        </DialogHeader>
        {restoredDraft && (
          <p role="status" className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span>Restored unsaved draft</span>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={discardDraft}>
              Discard
            </Button>
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Textarea
              value={urls}
              onChange={(e) => {
                setUrls(e.target.value);
                setError("");
                setResult("");
                setFailureDetails([]);
              }}
              placeholder="https://example.com/article"
              className="min-h-28 font-mono text-sm"
              autoFocus
              disabled={submitting}
            />
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
            {result && <p role="status" className="text-xs text-muted-foreground mt-1">{result}</p>}
            {failureDetails.length > 0 && (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-destructive" aria-label="Failed links">
                {failureDetails.map(({ url, reason }) => <li key={url} className="break-all">{url}: {reason}</li>)}
              </ul>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={readLater} onCheckedChange={(checked) => setReadLater(checked === true)} disabled={submitting} />
            Add these to Later
          </label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (optional, single URL only)" aria-label="Title" disabled={submitting} />
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Why did you save this? (single URL only)" disabled={submitting} />
          <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags, comma separated (single URL only)" aria-label="Tags" disabled={submitting} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!urls.trim() || submitting}>
              {submitting ? "Saving…" : urls.trim().split(/\s+/).length === 1 ? "Save Bookmark" : "Save links"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
