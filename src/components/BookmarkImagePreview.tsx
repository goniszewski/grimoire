import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function BookmarkImagePreview({ url, alt, onError }: { url: string; alt: string; onError: () => void }) {
  const [failed, setFailed] = useState(false);
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" aria-label={`Enlarge image: ${alt}`} className="min-w-0 overflow-hidden rounded-md border bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <img src={url} alt={alt} className="max-h-64 w-full object-contain" loading="lazy" onError={onError} />
      </button>
    </DialogTrigger>
    <DialogContent overlayClassName="z-[60]" className="z-[61] min-w-0 w-[calc(100%-2rem)] max-w-6xl max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="pr-6">Image preview</DialogTitle>
        <DialogDescription className="min-w-0 [overflow-wrap:anywhere]">{alt}</DialogDescription>
      </DialogHeader>
      {failed ? <p role="status">This image could not be loaded.</p> : <img src={url} alt={alt} className="max-h-[72dvh] w-full object-contain" onError={() => setFailed(true)} />}
    </DialogContent>
  </Dialog>;
}
