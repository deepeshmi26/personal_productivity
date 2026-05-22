import React from "react";

const journalData = [
  {
    id: "day-1",
    dateLabel: "Today",
    entries: [
      {
        id: "e1",
        time: "2:47 PM",
        content:
          "useEffect cleanup functions prevent memory leaks — always return a cleanup fn when subscribing to events",
        skipped: false,
      },
      { id: "e2", time: "2:30 PM", content: "skipped", skipped: true },
      {
        id: "e3",
        time: "11:14 AM",
        content:
          "The difference between map() and flatMap() is that flatMap flattens one level deep automatically",
        skipped: false,
      },
      { id: "e4", time: "9:02 AM", content: "skipped", skipped: true },
    ],
  },
  {
    id: "day-2",
    dateLabel: "Yesterday",
    entries: [
      {
        id: "e5",
        time: "6:55 PM",
        content:
          "Async/await is just syntactic sugar over Promises — the event loop still handles it the same way",
        skipped: false,
      },
      {
        id: "e6",
        time: "3:18 PM",
        content:
          "React renders are cheap. Reconciliation compares the virtual DOM diff, only real DOM changes are expensive",
        skipped: false,
      },
      {
        id: "e7",
        time: "10:43 AM",
        content:
          "Debouncing delays execution until after a pause. Throttling limits execution to once per interval",
        skipped: false,
      },
    ],
  },
];

export function TimelineStream() {
  return (
    <div
      className="relative mx-auto min-h-[100dvh] w-full max-w-[390px] bg-white overflow-hidden shadow-2xl sm:rounded-3xl sm:h-[844px] sm:min-h-0 sm:my-8 border border-neutral-200"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-neutral-100 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Journal
        </h1>
      </header>

      {/* Timeline Content */}
      <main className="px-6 py-8 pb-24 h-full overflow-y-auto">
        <div className="flex flex-col gap-10">
          {journalData.map((dayGroup) => (
            <section key={dayGroup.id} className="relative">
              {/* Day Header */}
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
                  {dayGroup.dateLabel}
                </h2>
                <span className="flex items-center justify-center px-2.5 py-0.5 rounded-full bg-neutral-100 text-xs font-medium text-neutral-600">
                  {dayGroup.entries.length}
                </span>
              </div>

              {/* Entries Timeline */}
              <div className="relative">
                {/* Continuous Left Rail */}
                <div className="absolute top-2 bottom-0 left-[7px] w-[2px] bg-neutral-100 rounded-full" />

                <div className="flex flex-col gap-8 relative">
                  {dayGroup.entries.map((entry) => (
                    <article
                      key={entry.id}
                      className="relative flex items-start gap-5 group"
                    >
                      {/* Timeline Dot Marker */}
                      <div className="relative z-10 flex-shrink-0 mt-1.5">
                        <div
                          className={`w-4 h-4 rounded-full border-[3px] border-white shadow-sm flex items-center justify-center ${
                            entry.skipped ? "bg-neutral-300" : "bg-black"
                          }`}
                        />
                      </div>

                      {/* Entry Content */}
                      <div className="flex flex-col gap-1.5 pt-0.5 flex-1">
                        <time className="text-xs font-medium text-neutral-500 tracking-wide">
                          {entry.time}
                        </time>
                        
                        {entry.skipped ? (
                          <p className="text-[15px] leading-relaxed text-neutral-400 italic line-through decoration-neutral-300">
                            {entry.content}
                          </p>
                        ) : (
                          <p className="text-[15px] leading-relaxed text-neutral-800 font-medium">
                            {entry.content}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
