import { Bookmark } from "@/types/bookmark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ExportMenuProps {
  bookmarks: Bookmark[];
  showLabel?: boolean;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toJSON(bookmarks: Bookmark[]): string {
  return JSON.stringify(bookmarks, null, 2);
}

function toCSV(bookmarks: Bookmark[]): string {
  const headers = ["id", "url", "title", "summary", "domain", "tags", "category", "status", "savedAt", "updatedAt"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = bookmarks.map((b) =>
    [
      b.id,
      b.url,
      escape(b.title),
      escape(b.summary),
      b.domain,
      escape(b.tags.join(", ")),
      escape(b.category),
      b.status,
      b.savedAt,
      b.updatedAt,
    ].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export function ExportMenu({ bookmarks, showLabel = true }: ExportMenuProps) {
  const handleExportJSON = () => {
    downloadFile(toJSON(bookmarks), "bookmarks.json", "application/json");
    toast({ title: "Exported as JSON", description: `${bookmarks.length} bookmarks` });
  };

  const handleExportCSV = () => {
    downloadFile(toCSV(bookmarks), "bookmarks.csv", "text/csv");
    toast({ title: "Exported as CSV", description: `${bookmarks.length} bookmarks` });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden sm:flex">
          <Download className="h-3.5 w-3.5" />
          {showLabel && <span className="ml-1.5">Export</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportJSON} className="text-xs font-mono">
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} className="text-xs font-mono">
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
