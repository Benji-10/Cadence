"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Search, X, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LocationDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: string;
  onChange: (value: string) => void;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

// A bottom-sheet location picker with more space for typing + an OpenStreetMap
// autocomplete search. Replaces the cramped inline input on mobile.
export function LocationDrawer({
  open,
  onOpenChange,
  value,
  onChange,
}: LocationDrawerProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setQuery(value), [value, open]);

  // Debounced Nominatim search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=8&addressdetails=1`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        if (res.ok) setResults((await res.json()) as NominatimResult[]);
      } catch {
        // network error
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const pick = (r: NominatimResult) => {
    const short = r.display_name.split(",").slice(0, 3).join(",").trim();
    setQuery(short);
    setPinned(short);
    setResults([]);
    inputRef.current?.focus();
  };

  const handleDone = () => {
    onChange(query);
    onOpenChange(false);
  };

  const handleClear = () => {
    setQuery("");
    setPinned(null);
    onChange("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] gap-0 p-0 safe-bottom"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="size-4 text-emerald-600" />
            Location
          </SheetTitle>
          <SheetDescription>
            Search for a place or type a custom location.
          </SheetDescription>
        </SheetHeader>

        {/* Search input — full width, no overflow */}
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5 focus-within:ring-1 focus-within:ring-ring">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPinned(null);
              }}
              placeholder="Search a place or type…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
            {query && (
              <button onClick={handleClear} aria-label="Clear">
                <X className="size-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Pinned indicator */}
        {pinned && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="size-3.5 shrink-0" />
            <span className="truncate">Pinned: {pinned}</span>
          </div>
        )}

        {/* Search results */}
        <div className="cal-scroll max-h-[40vh] flex-1 overflow-auto px-2 pb-2">
          {results.length === 0 && query.trim().length >= 3 && !loading && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No matches — you can still type a custom location above.
            </p>
          )}
          {results.map((r) => (
            <button
              key={`${r.lat}-${r.lon}`}
              onClick={() => pick(r)}
              className="flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {r.display_name.split(",")[0]}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.display_name.split(",").slice(1).join(",").trim()}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="safe-bottom flex gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleDone}
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
