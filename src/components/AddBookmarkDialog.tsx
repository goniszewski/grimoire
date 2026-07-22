import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { isSafeExternalBookmarkUrl } from "@/lib/safe-url";

interface AddBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (url: string) => Promise<void> | void;
}

export function AddBookmarkDialog({ open, onOpenChange, onAdd }: AddBookmarkDialogProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSafeExternalBookmarkUrl(url)) {
      setError("Please enter a valid URL (http or https, no credentials)");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onAdd(url.trim());
      setUrl("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save bookmark");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Bookmark
          </DialogTitle>
          <DialogDescription>
            Paste a URL to save it to your library. Content will be automatically fetched and indexed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              placeholder="https://example.com/article"
              className="font-mono text-sm"
              autoFocus
              disabled={submitting}
            />
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || submitting}>
              {submitting ? "Saving…" : "Save Bookmark"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
