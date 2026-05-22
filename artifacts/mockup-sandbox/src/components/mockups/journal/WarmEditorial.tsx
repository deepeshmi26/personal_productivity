import React from 'react';

const data = [
  {
    day: "Today",
    count: 4,
    entries: [
      { time: "2:47 PM", text: "useEffect cleanup functions prevent memory leaks — always return a cleanup fn when subscribing to events", skipped: false },
      { time: "2:30 PM", text: "skipped", skipped: true },
      { time: "11:14 AM", text: "The difference between map() and flatMap() is that flatMap flattens one level deep automatically", skipped: false },
      { time: "9:02 AM", text: "skipped", skipped: true },
    ]
  },
  {
    day: "Yesterday",
    count: 3,
    entries: [
      { time: "6:55 PM", text: "Async/await is just syntactic sugar over Promises — the event loop still handles it the same way", skipped: false },
      { time: "3:18 PM", text: "React renders are cheap. Reconciliation compares the virtual DOM diff, only real DOM changes are expensive", skipped: false },
      { time: "10:43 AM", text: "Debouncing delays execution until after a pause. Throttling limits execution to once per interval", skipped: false },
    ]
  }
];

export function WarmEditorial() {
  return (
    <div className="w-full max-w-[390px] min-h-[100dvh] bg-[#faf7f2] text-[#3a3028] mx-auto overflow-x-hidden relative flex flex-col">
      <div className="px-6 py-12 flex-1">
        <header className="mb-14 text-center">
          <p className="text-[10px] uppercase tracking-[0.25em] mb-4 text-[#8c7b6b]">
            Learn5
          </p>
          <h1 
            className="text-4xl font-normal italic tracking-tight" 
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Journal
          </h1>
        </header>

        <div className="space-y-14">
          {data.map((section, idx) => (
            <section key={idx}>
              <div className="border-t border-[#d8ccbe] mb-6 pt-4 flex justify-between items-baseline">
                <h2 
                  className="text-2xl" 
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                  {section.day}
                </h2>
                <span className="text-[10px] uppercase tracking-widest text-[#8c7b6b]">
                  {section.count} {section.count === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              
              <div className="space-y-8 pl-1">
                {section.entries.map((entry, entryIdx) => (
                  <article key={entryIdx} className="relative">
                    <time className="block text-[10px] uppercase tracking-[0.15em] text-[#a39485] mb-2 font-medium">
                      {entry.time}
                    </time>
                    {entry.skipped ? (
                      <p 
                        className="text-[15px] italic text-[#a39485] leading-relaxed"
                        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                      >
                        Skipped
                      </p>
                    ) : (
                      <p className="text-[15px] leading-relaxed text-[#3a3028]">
                        {entry.text}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
