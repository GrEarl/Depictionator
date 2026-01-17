"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Event = {
  id: string;
  title: string;
  worldStart: string | null;
  worldEnd: string | null;
  storyOrder: number | null;
  storyChapterId: string | null;
  eventType: string;
};

type VisualTimelineProps = {
  timelines: {
    id: string;
    name: string;
    type: string;
    events: Event[];
  }[];
  chapters: { id: string; name: string }[];
};

export function VisualTimeline({ timelines, chapters }: VisualTimelineProps) {
  return (
    <div className="flex flex-col gap-12 p-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
      {timelines.map((timeline) => (
        <div key={timeline.id} className="relative group">
          {/* Vertical line connector */}
          <div className="absolute left-[11px] top-12 bottom-0 w-[2px] bg-gradient-to-b from-accent/40 via-accent/10 to-transparent" />

          <div className="flex items-center gap-4 mb-8">
            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)] z-10">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </div>
            <div>
              <h4 className="text-xl font-black text-ink tracking-tighter uppercase italic">{timeline.name}</h4>
              <p className="text-[10px] font-bold text-muted uppercase tracking-[0.3em]">{timeline.type}</p>
            </div>
          </div>

          <div className="pl-12 grid gap-6 relative">
            {timeline.events.length === 0 && (
              <div className="p-8 rounded-2xl border border-dashed border-border bg-bg/50 text-center text-sm italic text-muted">
                The chronicle is empty for this timeline.
              </div>
            )}
            
            {[...timeline.events].sort((a, b) => (a.storyOrder ?? 0) - (b.storyOrder ?? 0)).map((event, idx) => (
              <div 
                key={event.id} 
                className="relative flex gap-6 group/event animate-in slide-in-from-left-4 duration-500" 
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {/* Horizontal marker */}
                <div className="absolute -left-12 top-4 w-8 h-[2px] bg-accent/20 group-hover/event:bg-accent/50 transition-colors" />
                
                <div className="flex-1 bg-panel border border-border rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-accent/30 transition-all group-hover/event:-translate-y-1">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border",
                          "bg-accent/5 border-accent/20 text-accent"
                        )}>
                          {event.eventType}
                        </span>
                        <span className="text-[10px] font-mono text-muted/60">{event.worldStart || "Undated"}</span>
                      </div>
                      <h5 className="text-base font-bold text-ink group-hover/event:text-accent transition-colors">
                        {event.title}
                      </h5>
                    </div>
                    
                    <Link 
                      href={`/timeline?editEvent=${event.id}`} 
                      className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent transition-colors"
                    >
                      Edit Entry
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>

                  {event.storyChapterId && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-bg rounded-full border border-border text-[10px] font-semibold text-muted">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                      {chapters.find((c) => c.id === event.storyChapterId)?.name ?? "Narrative Segment"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
