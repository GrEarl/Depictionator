"use client";

import Link from "next/link";

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
  // Simple swimlane view
  return (
    <div className="visual-timeline">
      {timelines.map((timeline) => (
        <div key={timeline.id} className="timeline-lane">
          <div className="lane-header">
            <h4>{timeline.name}</h4>
            <span className="badge">{timeline.type}</span>
          </div>
          <div className="lane-events">
            {timeline.events.length === 0 && <div className="muted p-4">No events in this lane.</div>}
            {[...timeline.events].sort((a, b) => (a.storyOrder ?? 0) - (b.storyOrder ?? 0)).map((event) => (
              <div key={event.id} className="event-card">
                <div className="event-card-header">
                  <strong>{event.title}</strong>
                  <span className={`event-type-pill type-${event.eventType}`}>{event.eventType}</span>
                </div>
                <div className="event-card-body">
                  {event.worldStart && <div className="event-meta-line">Date: {event.worldStart}</div>}
                  {event.storyChapterId && (
                    <div className="event-meta-line">Chapter: {chapters.find((c) => c.id === event.storyChapterId)?.name ?? "Chapter"}</div>
                  )}
                </div>
                <div className="event-card-actions">
                  <Link href={`/timeline?editEvent=${event.id}`} className="link-button-sm">Edit</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
