"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

// Location input with OpenStreetMap Nominatim autocomplete. Free, no API key
// required (rate-limited to 1 req/sec per Nominatim usage policy).
export function LocationAutocomplete({
  value,
  onChange,
  placeholder,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync external value → internal query (e.g. when the sheet opens).
  useEffect(() => {
    setQuery(value);
  }, [value]);

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
        )}&format=json&limit=5&addressdetails=1`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "en" },
        });
        if (res.ok) {
          const data = (await res.json()) as NominatimResult[];
          setResults(data);
          setOpen(true);
        }
      } catch {
        // network error — fail silently, user can still type manually
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (r: NominatimResult) => {
    // Use a shortened version: first 2-3 components of display_name.
    const short = r.display_name.split(",").slice(0, 3).join(",").trim();
    onChange(short);
    setQuery(short);
    setOpen(false);
    setActiveIdx(-1);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setActiveIdx(-1);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && results.length > 0) {
              e.preventDefault();
              setOpen(true);
              setActiveIdx((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === "ArrowUp" && results.length > 0) {
              e.preventDefault();
              setActiveIdx((i) => Math.max(-1, i - 1));
            } else if (e.key === "Enter" && activeIdx >= 0 && results[activeIdx]) {
              e.preventDefault();
              pick(results[activeIdx]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder ?? "Search a place…"}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {open && results.length > 0 && (
        <ul className="cal-scroll absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}`}>
              <button
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(r)}
                className={cn(
                  "flex w-full items-start gap-1.5 px-2.5 py-1.5 text-left text-xs transition-colors",
                  i === activeIdx ? "bg-accent" : "hover:bg-accent/50"
                )}
              >
                <MapPin className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {r.display_name.split(",")[0]}
                  </span>
                  <span className="block truncate text-muted-foreground">
                    {r.display_name.split(",").slice(1).join(",").trim()}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
