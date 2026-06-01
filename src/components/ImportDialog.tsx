import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { importBookmarksFile, subscribeToImportProgress } from "@/lib/api";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful import so the parent can refresh its list */
  onImport: () => void;
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");
  const [count, setCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhase("uploading");
    setProgress(10);
    setErrorMsg("");

    try {
      const result = await importBookmarksFile(file);
      const { importId, total } = result.data;

      setProgress(30);
      setPhase("processing");

      // Subscribe to SSE progress
      cleanupRef.current = subscribeToImportProgress(importId, (state) => {
        const completed = state.queued + state.skipped + state.merged + state.restored;
        const pct = total > 0
          ? 30 + Math.round((completed / total) * 70)
          : 100;
        setProgress(Math.min(pct, 100));

        if (state.error) {
          cleanupRef.current?.();
          cleanupRef.current = null;
          setErrorMsg(state.error);
          setPhase("error");
        } else if (state.done) {
          cleanupRef.current?.();
          cleanupRef.current = null;
          setCount(state.queued);
          setProgress(100);
          setPhase("done");
          onImport();
        }
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  };

  const handleClose = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setPhase("idle");
    setProgress(0);
    setCount(0);
    setErrorMsg("");
    onOpenChange(false);
  };

  const phaseLabel = phase === "uploading" ? "Uploading file..." : "Queuing bookmarks...";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import Bookmarks
          </DialogTitle>
          <DialogDescription>
            Upload a Netscape bookmark HTML file exported from your browser.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 w-full cursor-pointer hover:border-primary/50 transition-colors"
            >
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Drop your bookmark file here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to browse (.html)
                </p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        )}

        {(phase === "uploading" || phase === "processing") && (
          <div className="space-y-4 py-6">
            <p className="text-sm text-muted-foreground text-center">{phaseLabel}</p>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-pipeline-indexed" />
            <div className="text-center">
              <p className="font-semibold">
                {count} bookmark{count !== 1 ? "s" : ""} queued for processing
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Each bookmark will be fetched, extracted, and indexed in the background.
              </p>
            </div>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="text-center">
              <p className="font-semibold text-destructive">Import failed</p>
              <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <Button variant="outline" onClick={handleClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
