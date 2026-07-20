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
import { Upload, FileText, CheckCircle2 } from "lucide-react";
import { Bookmark } from "@/types/bookmark";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (bookmarks: Bookmark[]) => void;
}

function parseNetscapeBookmarks(html: string): Bookmark[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const links = doc.querySelectorAll("a");
  const bookmarks: Bookmark[] = [];

  links.forEach((link) => {
    const url = link.getAttribute("href");
    if (!url || !url.startsWith("http")) return;
    const title = link.textContent?.trim() || url;
    let domain = "";
    try {
      domain = new URL(url).hostname.replace("www.", "");
    } catch {
      return;
    }

    bookmarks.push({
      id: `bm-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url,
      title,
      summary: `Imported bookmark from ${domain}`,
      content: "",
      domain,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
      tags: [],
      category: "Imported",
      status: "indexed",
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return bookmarks;
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "parsing" | "done">("idle");
  const [count, setCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhase("parsing");
    setProgress(10);

    const text = await file.text();
    setProgress(40);

    await new Promise((r) => setTimeout(r, 500));
    const parsed = parseNetscapeBookmarks(text);
    setProgress(70);

    await new Promise((r) => setTimeout(r, 500));
    setProgress(100);
    setCount(parsed.length);
    setPhase("done");

    if (parsed.length > 0) onImport(parsed);
  };

  const handleClose = () => {
    setPhase("idle");
    setProgress(0);
    setCount(0);
    onOpenChange(false);
  };

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

        {phase === "parsing" && (
          <div className="space-y-4 py-6">
            <p className="text-sm text-muted-foreground text-center">Parsing bookmarks...</p>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-pipeline-indexed" />
            <div className="text-center">
              <p className="font-semibold">
                {count} bookmark{count !== 1 ? "s" : ""} imported
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                All bookmarks have been added to your library.
              </p>
            </div>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
