import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Entry = {
  id: string;
  time: string;
  text?: string;
  skipped: boolean;
};

type DayGroup = {
  dateLabel: string;
  entries: Entry[];
};

const data: DayGroup[] = [
  {
    dateLabel: "Today",
    entries: [
      {
        id: "1",
        time: "2:47 PM",
        text: "useEffect cleanup functions prevent memory leaks — always return a cleanup fn when subscribing to events",
        skipped: false,
      },
      {
        id: "2",
        time: "2:30 PM",
        skipped: true,
      },
      {
        id: "3",
        time: "11:14 AM",
        text: "The difference between map() and flatMap() is that flatMap flattens one level deep automatically",
        skipped: false,
      },
      {
        id: "4",
        time: "9:02 AM",
        skipped: true,
      },
    ],
  },
  {
    dateLabel: "Yesterday",
    entries: [
      {
        id: "5",
        time: "6:55 PM",
        text: "Async/await is just syntactic sugar over Promises — the event loop still handles it the same way",
        skipped: false,
      },
      {
        id: "6",
        time: "3:18 PM",
        text: "React renders are cheap. Reconciliation compares the virtual DOM diff, only real DOM changes are expensive",
        skipped: false,
      },
      {
        id: "7",
        time: "10:43 AM",
        text: "Debouncing delays execution until after a pause. Throttling limits execution to once per interval",
        skipped: false,
      },
    ],
  },
];

export function DarkGrid() {
  return (
    <div
      className="w-[390px] h-[844px] overflow-hidden bg-[#0d0d0d] font-mono text-zinc-300 relative mx-auto rounded-[40px] border-8 border-zinc-900 shadow-2xl flex flex-col"
      style={{
        backgroundImage: `radial-gradient(circle at center, rgba(30, 30, 30, 0.4) 1px, transparent 1px)`,
        backgroundSize: `24px 24px`,
      }}
    >
      {/* Header */}
      <div className="pt-14 pb-4 px-6 sticky top-0 bg-[#0d0d0d]/90 backdrop-blur-md z-10 border-b border-zinc-800/50">
        <h1 className="text-3xl font-bold text-white tracking-tighter">Journal</h1>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-6 space-y-10">
          {data.map((day) => (
            <div key={day.dateLabel} className="space-y-4">
              {/* Day Header */}
              <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">
                  {day.dateLabel}
                </h2>
                <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-xs rounded-full px-2">
                  {day.entries.length} entries
                </Badge>
              </div>

              {/* Entries */}
              <div className="space-y-3">
                {day.entries.map((entry) => (
                  <Card
                    key={entry.id}
                    className="bg-[#141414] border-zinc-800 shadow-[0_0_15px_rgba(0,0,0,0.5)] p-4 rounded-2xl hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Timeline / Time */}
                      <div className="text-xs text-zinc-500 font-semibold w-16 shrink-0 pt-0.5">
                        {entry.time}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {entry.skipped ? (
                          <div className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                            Skipped
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-200 leading-relaxed font-sans">
                            {entry.text}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
