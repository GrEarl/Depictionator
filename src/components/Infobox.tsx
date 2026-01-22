"use client";

import type { ReactNode } from "react";
import Image from "next/image";

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
          <Image
            src={image.src}
            alt={image.alt}
            width={280}
            height={280}
            className="markdown-infobox-image"
            style={{ objectFit: "cover" }}
            unoptimized={image.src.startsWith("http")}
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
