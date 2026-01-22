"use client";

import { ReactNode } from "react";

type TooltipProps = {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
};

export function Tooltip({ content, children, position = "top", delay = 0 }: TooltipProps) {
  return (
    <div className="tooltip-wrapper" style={{ "--tooltip-delay": `${delay}ms` } as React.CSSProperties}>
      {children}
      <div className={`tooltip tooltip-${position}`} role="tooltip">
        {content}
        <div className="tooltip-arrow" />
      </div>
    </div>
  );
}
