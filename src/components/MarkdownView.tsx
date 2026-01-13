"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "@/components/Mermaid";

type MarkdownViewProps = {
  value: string;
};

export function MarkdownView({ value }: MarkdownViewProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            const language = /language-(\w+)/.exec(className ?? "");
            if (!inline && language?.[1] === "mermaid") {
              return <Mermaid code={String(children).trim()} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
