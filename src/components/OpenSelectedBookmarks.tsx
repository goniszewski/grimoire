import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { openSelectedBookmarks, MAX_OPEN_TABS, type OpenableBookmark } from "@/lib/bookmark-open";

type SelectedBookmark = OpenableBookmark & { title: string };

export function OpenSelectedBookmarks({ bookmarks }: { bookmarks: SelectedBookmark[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<SelectedBookmark[]>([]);
  const [message, setMessage] = useState("");
  const tooMany = pending.length > MAX_OPEN_TABS;
  const launch = () => {
    const result = openSelectedBookmarks(pending);
    setPending(pending.filter((bookmark) => result.blockedIds.includes(bookmark.id)));
    setMessage(`${result.opened} tabs opened.${result.blockedIds.length ? ` ${result.blockedIds.length} blocked. Allow popups for Grimoire, then retry the remaining tabs.` : ""}${result.unsafeIds.length ? ` ${result.unsafeIds.length} unsafe URLs skipped.` : ""}`);
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
    <Button variant="outline" size="sm" className="text-xs h-7" disabled={!bookmarks.length} onClick={() => {
      setPending(bookmarks.map((bookmark) => ({ ...bookmark }))); setMessage("");
    }}><ExternalLink className="h-3 w-3 mr-1.5" />Open selected ({bookmarks.length})</Button>
    </DialogTrigger>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Open selected bookmarks</DialogTitle>
          <DialogDescription>{tooMany ? `Select at most ${MAX_OPEN_TABS} bookmarks at a time. You selected ${pending.length}.` : pending.length === 0 ? "Finished opening the selected bookmarks." : `Open ${pending.length} websites in new tabs. Your browser may ask you to allow popups.`}</DialogDescription>
        </DialogHeader>
        {!tooMany && <ul className="max-h-56 overflow-y-auto space-y-2 text-sm">{pending.map((bookmark) => <li key={bookmark.id} className="break-words">{bookmark.title}</li>)}</ul>}
        {message && <p role="status" className="text-sm">{message}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>{pending.length ? "Cancel" : "Done"}</Button>
          {!tooMany && pending.length > 0 && <Button onClick={launch}>{message ? "Retry remaining tabs" : `Open ${pending.length} tabs`}</Button>}
        </div>
      </DialogContent>
  </Dialog>;
}
