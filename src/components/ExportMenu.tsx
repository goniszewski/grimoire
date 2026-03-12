import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const DAEMON_URL = "http://127.0.0.1:3210";

interface ExportMenuProps {
  showLabel?: boolean;
  filters?: {
    tag?: string;
    domain?: string;
    category?: string;
    date_from?: string;
    date_to?: string;
  };
}

async function triggerDownload(format: "json" | "csv", filters: ExportMenuProps["filters"] = {}) {
  const params = new URLSearchParams({ format });
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.category) params.set("category", filters.category);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);

  const url = `${DAEMON_URL}/export?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `bookmarks.${format}`;

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);

    toast({ title: `Exported as ${format.toUpperCase()}` });
  } catch (err) {
    toast({
      title: "Export failed",
      description: err instanceof Error ? err.message : "Unknown error",
      variant: "destructive",
    });
  }
}

export function ExportMenu({ showLabel = true, filters }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden sm:flex">
          <Download className="h-3.5 w-3.5" />
          {showLabel && <span className="ml-1.5">Export</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => triggerDownload("json", filters)} className="text-xs font-mono">
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => triggerDownload("csv", filters)} className="text-xs font-mono">
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
