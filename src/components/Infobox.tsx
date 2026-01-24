"use client";

import type { ReactNode } from "react";

type InfoboxMediaItem = {
  src: string;
  caption?: string;
};

type InfoboxProps = {
  title: string;
  image?: {
    src: string;
    alt: string;
    caption?: string;
  };
  audio?: InfoboxMediaItem[];
  video?: InfoboxMediaItem[];
  rows: {
    label: string;
    value: string | ReactNode;
  }[];
};

export function Infobox({ title, image, audio, video, rows }: InfoboxProps) {
  return (
    <div className="markdown-infobox">
      {image && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={image.alt}
            className="markdown-infobox-image w-full h-auto max-h-[280px] object-cover"
          />
          {image.caption && (
            <div className="px-3 py-2 text-xs text-muted text-center border-b border-border bg-bg-elevated">
              {image.caption}
            </div>
          )}
        </div>
      )}

      {/* Audio files */}
      {audio && audio.length > 0 && (
        <div className="px-3 py-2 border-b border-border bg-bg-elevated">
          {audio.map((item, index) => (
            <div key={index} className="mb-2 last:mb-0">
              <audio
                controls
                src={item.src}
                className="w-full h-8"
                preload="metadata"
              />
              {item.caption && (
                <div className="text-xs text-muted text-center mt-1">
                  {item.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video files */}
      {video && video.length > 0 && (
        <div className="px-3 py-2 border-b border-border bg-bg-elevated">
          {video.map((item, index) => (
            <div key={index} className="mb-2 last:mb-0">
              <video
                controls
                src={item.src}
                className="w-full max-h-[200px]"
                preload="metadata"
              />
              {item.caption && (
                <div className="text-xs text-muted text-center mt-1">
                  {item.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="markdown-infobox-body">
        <div className="markdown-infobox-title">{title}</div>
        <table className="markdown-infobox-table">
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <th>{row.label}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
