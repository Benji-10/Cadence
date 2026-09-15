"use client";

import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useIcsImport, useCalendars } from "@/hooks/use-calendar-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// Reads a .ics file, shows a preview, and posts it to /api/ical/import.
export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { data: calData } = useCalendars();
  const calendars = calData?.calendars ?? [];
  const [calendarId, setCalendarId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [icsText, setIcsText] = useState<string>("");
  const importMut = useIcsImport();
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveCalId =
    calendarId || calendars[0]?.id || "";

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setIcsText(text);
  };

  const handleImport = async () => {
    if (!icsText.trim()) {
      toast.error("Choose a .ics file first.");
      return;
    }
    if (!effectiveCalId) {
      toast.error("Pick a calendar to import into.");
      return;
    }
    try {
      const res = await importMut.mutateAsync({
        ics: icsText,
        calendarId: effectiveCalId,
      });
      toast.success(`Imported ${res.imported} event${res.imported === 1 ? "" : "s"}.`, {
        description: res.titles.slice(0, 3).join(" · "),
      });
      onOpenChange(false);
      setFileName("");
      setIcsText("");
    } catch (e) {
      toast.error("Couldn't import", { description: String(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4 text-emerald-600" />
            Import .ics file
          </DialogTitle>
          <DialogDescription>
            Parse an iCalendar file from Apple Calendar, Google Calendar, or
            Outlook and add its events. Titles are auto-categorised by Cadence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Calendar picker */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Import into calendar
            </label>
            <Select value={effectiveCalId} onValueChange={setCalendarId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select calendar" />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File picker */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5"
              )}
            >
              {fileName ? (
                <>
                  <CheckCircle2 className="size-6 text-emerald-600" />
                  <span className="text-sm font-medium">{fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {icsText.length.toLocaleString()} chars · ready to import
                  </span>
                </>
              ) : (
                <>
                  <FileText className="size-6 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Click to choose a .ics file
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Exported from any calendar app
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importMut.isPending || !icsText}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {importMut.isPending ? "Importing…" : "Import"}
            </Button>
          </div>
          {importMut.isError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5" />
              {String(importMut.error)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
