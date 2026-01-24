"use client";

import type { ReactNode } from "react";

type InfoboxProps = {
  title: string;
  image?: {
    src: string;
    alt: string;
    caption?: string;
  };
  rows: {
    label: string;
    value: string | ReactNode;
  }[];
};

export function Infobox({ title, image, rows }: InfoboxProps) {
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
