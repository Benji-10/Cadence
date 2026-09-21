// Categorization rules: infer the intelligence metadata (category, flexibility,
// location type, min chunk, overlap-allowed) from a human-readable event title.
// This is what makes a freshly-typed event "just work" with the scheduler.

import {
  CalendarEvent,
  EventCategory,
  Flexibility,
  LocationType,
} from "../types";

export interface InferredMeta {
  category: EventCategory;
  flexibility: Flexibility;
  locationType: LocationType;
  minChunkMins: number;
  allowOverlap: boolean;
  calendarKind:
    | "work"
    | "study"
    | "sport"
    | "home"
    | "social"
    | "personal";
  color: string; // suggested calendar colour
}

interface Rule {
  keywords: string[];
  meta: InferredMeta;
}

// Ordered — first match wins, so put more specific rules first.
const RULES: Rule[] = [
  {
    keywords: ["computer organization", "computer graphics", "programming languages", "machine learning", "lecture", "class", "tutorial", "seminar", "lab"],
    meta: {
      category: "lecture",
      flexibility: "fixed",
      locationType: "campus",
      minChunkMins: 50,
      allowOverlap: false,
      calendarKind: "study",
      color: "#F59E0B", // amber
    },
  },
  {
    keywords: ["volleyball", "badminton", "sport", "gym", "football", "basketball", "swim", "swimming", "training", "match", "practice"],
    meta: {
      category: "sport",
      flexibility: "fixed",
      locationType: "sports",
      minChunkMins: 60,
      allowOverlap: false,
      calendarKind: "sport",
      color: "#10B981", // emerald
    },
  },
  {
    keywords: ["sleep"],
    meta: {
      category: "sleep",
      flexibility: "fixed",
      locationType: "home",
      minChunkMins: 480,
      allowOverlap: false,
      calendarKind: "personal",
      color: "#6366F1", // indigo (sleep is the one allowed indigo)
    },
  },
  {
    keywords: ["travel home", "travel to campus", "get ready + travel", "commute", "travel to", "travel"],
    meta: {
      category: "travel",
      flexibility: "fixed",
      locationType: "any",
      minChunkMins: 20,
      allowOverlap: false,
      calendarKind: "personal",
      color: "#9CA3AF", // gray
    },
  },
  {
    keywords: ["laundry", "washing", "clothes"],
    meta: {
      category: "laundry",
      flexibility: "flexible",
      locationType: "home",
      minChunkMins: 90,
      allowOverlap: true, // can run while you work at home
      calendarKind: "home",
      color: "#06B6D4", // cyan
    },
  },
  {
    keywords: ["weekly shopping", "shopping", "groceries", "grocery"],
    meta: {
      category: "shopping",
      flexibility: "movable",
      locationType: "out",
      minChunkMins: 90,
      allowOverlap: false,
      calendarKind: "home",
      color: "#0EA5E9", // sky
    },
  },
  {
    keywords: ["cook", "dinner", "lunch", "breakfast", "meal", "cooking"],
    meta: {
      category: "cooking",
      flexibility: "movable",
      locationType: "home",
      minChunkMins: 60,
      allowOverlap: false,
      calendarKind: "home",
      color: "#F97316", // orange
    },
  },
  {
    keywords: ["paid work", "shift", "work shift", "client work"],
    meta: {
      category: "work",
      flexibility: "flexible",
      locationType: "any",
      minChunkMins: 60,
      allowOverlap: false,
      calendarKind: "work",
      color: "#EF4444", // red
    },
  },
  {
    keywords: ["homework", "assignment", "coursework", "problem set", "prep"],
    meta: {
      category: "homework",
      flexibility: "flexible",
      locationType: "any",
      minChunkMins: 45,
      allowOverlap: false,
      calendarKind: "study",
      color: "#8B5CF6", // violet
    },
  },
  {
    keywords: ["language study", "language", "spanish", "french", "german", "japanese", "duolingo", "vocab"],
    meta: {
      category: "language",
      flexibility: "flexible",
      locationType: "any",
      minChunkMins: 30,
      allowOverlap: false,
      calendarKind: "study",
      color: "#EC4899", // pink
    },
  },
  {
    keywords: ["personal app coding", "coding", "project", "side project", "build", "ship", "develop"],
    meta: {
      category: "coding",
      flexibility: "flexible",
      locationType: "home",
      minChunkMins: 60,
      allowOverlap: false,
      calendarKind: "work",
      color: "#14B8A6", // teal
    },
  },
  {
    keywords: ["uk ppl", "ppl theory", "ppl", "flying", "aviation", "ground school"],
    meta: {
      category: "ppl",
      flexibility: "flexible",
      locationType: "home",
      minChunkMins: 45,
      allowOverlap: false,
      calendarKind: "study",
      color: "#3B82F6", // blue (only allowed blue — aviation/navy)
    },
  },
  {
    keywords: ["cubing", "recording", "rubik", "speedcube", "edit video"],
    meta: {
      category: "cubing",
      flexibility: "flexible",
      locationType: "home",
      minChunkMins: 30,
      allowOverlap: false,
      calendarKind: "personal",
      color: "#A855F7", // purple
    },
  },
  {
    keywords: ["friends", "social", "party", "hangout", "pub", "outing", "gather"],
    meta: {
      category: "social",
      flexibility: "movable",
      locationType: "out",
      minChunkMins: 90,
      allowOverlap: false,
      calendarKind: "social",
      color: "#22C55E", // green
    },
  },
  {
    keywords: ["break", "shower", "free time", "free", "anything block", "anything", "prepare", "wind down", "relax"],
    meta: {
      category: "free",
      flexibility: "flexible",
      locationType: "any",
      minChunkMins: 20,
      allowOverlap: false,
      calendarKind: "personal",
      color: "#D1D5DB", // light gray
    },
  },
];

const DEFAULT_META: InferredMeta = {
  category: "other",
  flexibility: "movable",
  locationType: "any",
  minChunkMins: 30,
  allowOverlap: false,
  calendarKind: "personal",
  color: "#64748B", // slate
};

export function inferMetaFromTitle(title: string): InferredMeta {
  const t = title.trim().toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => t.includes(k))) {
      return { ...rule.meta };
    }
  }
  return { ...DEFAULT_META };
}

// Convenience: merge inferred metadata onto a partial event, only filling fields
// the caller hasn't explicitly set.
export function applyInferredMeta(
  event: Partial<CalendarEvent> & { title: string },
  opts: { respectExisting?: boolean } = {}
): Partial<CalendarEvent> & { title: string } {
  const inferred = inferMetaFromTitle(event.title);
  const respect = opts.respectExisting ?? true;
  const pick = <T,>(existing: T | undefined, inferredVal: T): T =>
    respect && existing !== undefined ? existing : inferredVal;
  return {
    ...event,
    category: pick(event.category, inferred.category) as EventCategory,
    flexibility: pick(event.flexibility, inferred.flexibility) as Flexibility,
    locationType: pick(event.locationType, inferred.locationType) as LocationType,
    minChunkMins: pick(event.minChunkMins, inferred.minChunkMins),
    allowOverlap: pick(event.allowOverlap, inferred.allowOverlap),
  };
}

export function describeFlexibility(f: Flexibility): string {
  switch (f) {
    case "fixed":
      return "Fixed — lectures, sport & appointments stay put. Other tasks move around it.";
    case "movable":
      return "Movable — can be dragged to another slot, but not split.";
    case "flexible":
      return "Flexible — can be moved and split into sensible chunks.";
  }
}
