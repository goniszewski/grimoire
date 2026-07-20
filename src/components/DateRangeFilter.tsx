import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangeFilterProps {
  from: Date | null;
  to: Date | null;
  onChange: (range: { from: Date | null; to: Date | null }) => void;
  showLabel?: boolean;
}

export function DateRangeFilter({ from, to, onChange, showLabel = true }: DateRangeFilterProps) {
  const hasRange = from || to;

  const label = hasRange
    ? [from && format(from, "MMM d"), to && format(to, "MMM d")].filter(Boolean).join(" – ")
    : "Date range";

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 text-xs font-mono gap-1.5",
              hasRange && "border-primary/50 text-primary"
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {showLabel && label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={from && to ? { from, to } : from ? { from, to: undefined } : undefined}
            onSelect={(range) =>
              onChange({ from: range?.from ?? null, to: range?.to ?? null })
            }
            numberOfMonths={2}
            disabled={(date) => date > new Date()}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {hasRange && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onChange({ from: null, to: null })}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
