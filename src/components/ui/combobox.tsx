import * as React from "react";
import { Check, ChevronsUpDown, Loader2, RotateCcw, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxItem {
  value: string;
  label: string;
  hint?: string;
}

interface ComboboxProps {
  /** Currently selected value shown in the trigger. */
  value: string;
  onValueChange: (value: string) => void;
  items: ComboboxItem[];
  /** Accessible name for the trigger (combobox role does not use text content). */
  ariaLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Allow selecting a value not present in `items` (typed by the user). */
  allowCustom?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Searchable select built on Radix Popover + cmdk Command.
 * When `allowCustom` is set and the typed query matches no item, a
 * "Use &quot;query&quot;" entry lets the user keep an arbitrary value.
 */
export function Combobox({
  value,
  onValueChange,
  items,
  ariaLabel,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found",
  allowCustom = false,
  loading = false,
  error = null,
  onRetry,
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = items.find((item) => item.value === value);
  const trimmedQuery = query.trim();
  const trimmedLower = trimmedQuery.toLowerCase();
  const filteredItems = trimmedLower
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(trimmedLower) ||
          item.value.toLowerCase().includes(trimmedLower)
      )
    : items;
  const customMatch =
    trimmedQuery && !items.some((item) => item.value.toLowerCase() === trimmedLower);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-8 w-full justify-between px-3 text-sm font-normal", className)}
        >
          <span className="truncate font-mono text-xs">
            {selected ? selected.label : value || placeholder}
          </span>
          {loading ? (
            <Loader2 className="ml-2 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              className="h-9"
            />
          </div>
          <CommandList>
            {error && (
              <div className="p-3 text-xs text-destructive">
                <p className="break-words">{error}</p>
                {onRetry && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7"
                    onClick={() => onRetry()}
                  >
                    <RotateCcw className="mr-1.5 h-3 w-3" />
                    Retry
                  </Button>
                )}
              </div>
            )}
            {loading && items.length === 0 && !error ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading models…
              </div>
            ) : (
              <>
                {customMatch && allowCustom && (
                  <CommandGroup>
                    <CommandItem
                      value={trimmedQuery}
                      onSelect={() => {
                        onValueChange(trimmedQuery);
                        setOpen(false);
                      }}
                    >
                      Use “{trimmedQuery}”
                    </CommandItem>
                  </CommandGroup>
                )}
                {!error && (
                  <>
                    <CommandGroup>
                      {filteredItems.map((item) => (
                        <CommandItem
                          key={item.value}
                          value={item.value}
                          onSelect={() => {
                            onValueChange(item.value);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-3.5 w-3.5 shrink-0",
                              value === item.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                          {item.hint && (
                            <span className="ml-auto pl-2 text-[10px] text-muted-foreground">
                              {item.hint}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {filteredItems.length === 0 && !(customMatch && allowCustom) && (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        {emptyText}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
