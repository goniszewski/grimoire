import { FormEvent, useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_TAG_DESCRIPTION_LEN, MAX_TAG_NAME_LEN, normaliseTagName, validateTagName } from "@/lib/tag-names";

interface RenameableTag {
  id: string;
  name: string;
  description?: string | null;
}

interface TagRenameDialogProps {
  tag: RenameableTag | null;
  open: boolean;
  error: string | null;
  pending: boolean;
  onClearError: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { name: string; description: string | null }) => void;
}

export function TagRenameDialog({
  tag,
  open,
  error,
  pending,
  onClearError,
  onOpenChange,
  onSubmit,
}: TagRenameDialogProps) {
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !tag) return;
    setValue(tag.name);
    setDescription(tag.description ?? "");
    setFormError(null);
  }, [open, tag]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normaliseTagName(value);
    const validationError = validateTagName(name);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    onSubmit({ name, description: description.trim() || null });
  }

  const visibleError = formError ?? error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit #{tag?.name}</DialogTitle>
          <DialogDescription>Rename the tag or describe what it is for. Existing bookmarks keep the tag.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-rename-name">New tag name</Label>
            <Input
              id="tag-rename-name"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setFormError(null);
                onClearError();
              }}
              maxLength={MAX_TAG_NAME_LEN + 8}
              aria-invalid={!!visibleError}
              aria-describedby={visibleError ? "tag-rename-error" : undefined}
            />
            {visibleError && (
              <p id="tag-rename-error" className="text-xs text-destructive">
                {visibleError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-edit-description">Tag description (optional)</Label>
            <Textarea
              id="tag-edit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={MAX_TAG_DESCRIPTION_LEN}
              rows={3}
              placeholder="What is this tag for?"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Save tag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
