import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { buildExportUrl, type ExportFilters } from "@/lib/export-url";

interface ExportMenuProps {
  showLabel?: boolean;
  filters?: ExportFilters;
}

async function triggerDownload(format: "json" | "csv", filters: ExportMenuProps["filters"] = {}) {
  const url = buildExportUrl(format, filters);
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
