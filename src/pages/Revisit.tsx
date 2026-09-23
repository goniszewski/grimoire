import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, BookOpenCheck, ExternalLink, MoreHorizontal, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBookmark, getRevisitState, startRevisitRound, actOnRevisit, undoRevisit, type RevisitState, type RevisitDecision } from "@/lib/api";
import { normaliseDaemonMediaUrl } from "@/lib/media-url";
import { openBookmarkExternal } from "@/lib/bookmark-open";
import { bookmarkKeys } from "@/hooks/use-bookmarks";
import { useAppLock } from "@/hooks/use-app-lock";
import { LockScreen } from "@/components/LockScreen";

const revisitKey = ["revisit"];

export default function Revisit(): JSX.Element {
  const qc = useQueryClient();
  const appLock = useAppLock();
  const [readerOpen, setReaderOpen] = useState(false);
  const [roundSize, setRoundSize] = useState<5 | 10 | 20>(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { data, isLoading } = useQuery({ queryKey: revisitKey, queryFn: getRevisitState, enabled: !appLock.locked });
  const state = data?.data;
  const round = state?.round;
  const card = round?.current;
  const { data: detail, isLoading: readerLoading } = useQuery({
    queryKey: ["revisit-reader", card?.id],
    queryFn: () => getBookmark(card!.id),
    enabled: readerOpen && !!card?.id && !appLock.locked,
  });

  const apply = async (operation: () => Promise<{ data: RevisitState }>): Promise<void> => {
    setBusy(true);
    setError("");
    try {
      const next = await operation();
      qc.setQueryData(revisitKey, next);
      qc.invalidateQueries({ queryKey: bookmarkKeys.all });
      setReaderOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this round.");
      await qc.invalidateQueries({ queryKey: revisitKey });
    } finally {
      setBusy(false);
    }
  };

  if (appLock.locked) return <LockScreen onUnlock={appLock.unlock} />;

  const counts = (round?.decisions ?? []).reduce<Record<RevisitDecision, number>>(
    (value, decision) => ({ ...value, [decision]: value[decision] + 1 }),
    { read: 0, done: 0, skipped: 0, postponed: 0, trashed: 0 }
  );
  const screenshot = normaliseDaemonMediaUrl(card?.screenshot_url);
  const markdown = detail?.data.content?.markdown?.trim();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Library
          </Link>
          <span className="text-sm font-medium">Later / Revisit</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {round && !round.completed ? `${round.position + 1} of ${round.size}` : ""}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-8 sm:px-8">
        {error && <p role="alert" className="mb-5 rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
        {isLoading && <p className="text-sm text-muted-foreground">Loading Later…</p>}
        {!isLoading && state && (!round || round.completed) && (
          <section className="mx-auto max-w-xl space-y-5 rounded-xl border bg-card p-6 sm:p-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Later</p>
              <h1 className="mt-2 text-2xl font-semibold">{round?.completed ? "That’s this round." : "A few things you saved"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {round?.completed
                  ? `${counts.read} marked read · ${counts.done} removed from Later · ${counts.skipped} skipped · ${counts.postponed} postponed · ${counts.trashed} moved to Trash`
                  : `${state.total} saved for later · ${state.eligible} available now`}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">Work through a small shuffled stack at your own pace. Opening a link leaves it in Later until you decide.</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || state.eligible === 0} onClick={() => void apply(() => startRevisitRound(roundSize))}>Revisit {roundSize} bookmarks</Button>
              <Select value={String(roundSize)} onValueChange={(value) => setRoundSize(Number(value) as 5 | 10 | 20)}>
                <SelectTrigger aria-label="Round size" className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="5">5</SelectItem><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem></SelectContent>
              </Select>
              <Button asChild variant="outline"><Link to="/?later=1">Browse all</Link></Button>
              {round?.can_undo && <Button variant="ghost" disabled={busy} onClick={() => void apply(undoRevisit)}><RotateCcw className="mr-2 h-4 w-4" />Undo</Button>}
            </div>
            {state.total > 0 && state.eligible === 0 && <p className="text-sm text-muted-foreground">Everything in Later is postponed for now.</p>}
          </section>
        )}
        {card && round && !round.completed && (
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{round.size - round.position} cards left in this stack</span>
              <Link to="/" className="hover:text-foreground">Pause round</Link>
            </div>
            <div className="relative pb-8 pt-1">
              {round.upcoming.slice(0, 2).reverse().map((next, index) => (
                <div
                  key={next.id}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-8 top-1 rounded-xl border bg-muted shadow-sm"
                  style={{ transform: `translateY(${index === 0 && round.upcoming.length > 1 ? 28 : 14}px) scaleX(${index === 0 && round.upcoming.length > 1 ? 0.94 : 0.97})`, transformOrigin: "top center" }}
                />
              ))}
            <article className="relative rounded-xl border bg-card shadow-md">
              {screenshot && <img src={screenshot} alt="Page preview" className="max-h-72 w-full rounded-t-xl object-cover" />}
              <div className="space-y-5 p-5 sm:p-7">
                <div>
                  <h1 className="break-words text-xl font-semibold sm:text-2xl">{card.title || card.url}</h1>
                  <p className="mt-2 text-xs text-muted-foreground">{card.domain} · Saved {formatDistanceToNow(new Date(card.created_at), { addSuffix: true })}</p>
                </div>
                {card.notes && <div className="rounded-md border-l-2 border-primary bg-muted/40 p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide">Your note</p><p className="whitespace-pre-wrap text-sm">{card.notes}</p></div>}
                {(card.summary || card.description) && <p className="text-sm leading-relaxed text-muted-foreground">{card.summary || card.description}</p>}
                {!card.summary && !card.description && <p className="text-sm text-muted-foreground">No preview is available yet. The saved link is still ready to open.</p>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setReaderOpen(true)}>Read here</Button>
                  <Button variant="outline" onClick={() => {
                    if (!openBookmarkExternal(card)) setError("This saved URL cannot be opened safely.");
                  }}><ExternalLink className="mr-2 h-4 w-4" />Open original</Button>
                </div>
              </div>
              <div className="sticky bottom-0 z-10 space-y-2 rounded-b-xl border-t bg-card p-4 shadow-[0_-4px_16px_-12px_rgba(0,0,0,0.45)] sm:static sm:bg-muted/20 sm:shadow-none">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => void apply(() => actOnRevisit(card.id, "skipped"))}><SkipForward className="mr-2 h-4 w-4" />Skip</Button>
                  <Button disabled={busy} onClick={() => void apply(() => actOnRevisit(card.id, card.read_at ? "done" : "read"))}>
                    {!card.read_at && <BookOpenCheck className="mr-2 h-4 w-4" />}
                    {card.read_at ? "Done with this" : "Mark as read"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select disabled={busy} onValueChange={(value) => void apply(() => actOnRevisit(card.id, "postponed", value as "day" | "week" | "month"))}>
                    <SelectTrigger aria-label="Postpone for" className="w-full"><SelectValue placeholder="Postpone for…" /></SelectTrigger>
                    <SelectContent><SelectItem value="day">1 day</SelectItem><SelectItem value="week">1 week</SelectItem><SelectItem value="month">1 month</SelectItem></SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" disabled={busy}><MoreHorizontal className="mr-2 h-4 w-4" />More</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!card.read_at && <DropdownMenuItem onSelect={() => void apply(() => actOnRevisit(card.id, "done"))}>Remove from Later</DropdownMenuItem>}
                      <DropdownMenuItem onSelect={() => void apply(() => actOnRevisit(card.id, "trashed"))}>Move to Trash</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </article>
            </div>
            {round.upcoming[0] && <p className="truncate px-3 text-xs text-muted-foreground">Up next: {round.upcoming[0].title || round.upcoming[0].domain}</p>}
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{card.read_at ? "Already read. Done removes it from Later." : "Mark as read clears Later and keeps the bookmark. Skip leaves it in Later."} Postpone keeps it in Later and makes it available after the chosen time.</span>
              <Button variant="ghost" size="sm" disabled={busy || !round.can_undo} onClick={() => void apply(undoRevisit)}><RotateCcw className="mr-1 h-3.5 w-3.5" />Undo</Button>
            </div>
          </div>
        )}
      </main>
      <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{card?.title || card?.url}</DialogTitle></DialogHeader>
          {readerLoading && <p className="text-sm text-muted-foreground">Loading saved content…</p>}
          {markdown
            ? <div className="prose prose-sm max-w-none break-words dark:prose-invert"><ReactMarkdown>{markdown}</ReactMarkdown></div>
            : !readerLoading && <p className="text-sm text-muted-foreground">Extracted content is unavailable. Open the original page to read it.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
