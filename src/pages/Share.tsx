import { useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBookmark } from "@/lib/api";
import { parseSharedLink } from "@/lib/share-target";

/** Landing page for the Web Share Target: saves the shared link, then confirms. */
const Share = () => {
  const [params] = useSearchParams();
  const link = useMemo(() => parseSharedLink(params), [params]);
  const started = useRef(false);

  const save = useMutation({
    mutationFn: (shared: NonNullable<typeof link>) => createBookmark(shared.url, shared.title),
  });

  useEffect(() => {
    // Strict Mode runs effects twice in development; a share must save exactly once.
    if (!link || started.current) return;
    started.current = true;
    save.mutate(link);
  }, [link, save]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm space-y-4 rounded border bg-background p-6 text-center" role="status" aria-live="polite">
        {!link ? (
          <>
            <XCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="text-sm font-medium">Nothing to save</p>
            <p className="text-xs text-muted-foreground">The shared content did not include a web link.</p>
          </>
        ) : save.isError ? (
          <>
            <XCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="text-sm font-medium">Could not save</p>
            <p className="break-words text-xs text-muted-foreground">{save.error.message}</p>
            <Button size="sm" onClick={() => save.mutate(link)}>
              Try again
            </Button>
          </>
        ) : save.isSuccess ? (
          <>
            <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
            <p className="text-sm font-medium">Saved to Grimoire</p>
            <p className="break-all text-xs text-muted-foreground">{link.url}</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">Saving…</p>
          </>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to="/">Open Grimoire</Link>
        </Button>
      </div>
    </main>
  );
};

export default Share;
