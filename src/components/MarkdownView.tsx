"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "@/components/Mermaid";
import { createSlugger } from "@/lib/markdown";

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return extractText(props?.children ?? "");
  }
  return "";
}

type MarkdownViewProps = {
  value: string;
};

export function MarkdownView({ value }: MarkdownViewProps) {
  const slugger = createSlugger();
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img({ src, alt, ...props }) {
            const safeSrc = typeof src === "string" ? src : "";
            const safeAlt = alt ?? "";
            if (safeAlt.toLowerCase().startsWith("audio:")) {
              const title = safeAlt.slice("audio:".length).trim();
              return (
                <div className="markdown-audio">
                  {title && <div className="text-sm text-muted mb-1">{title}</div>}
                  <audio controls src={safeSrc} className="w-full">
                    Your browser does not support the audio element.
                  </audio>
                </div>
              );
            }
            if (safeAlt.toLowerCase().startsWith("video:")) {
              const title = safeAlt.slice("video:".length).trim();
              return (
                <div className="markdown-video">
                  {title && <div className="text-sm text-muted mb-1">{title}</div>}
                  <video controls src={safeSrc} className="w-full">
                    Your browser does not support the video element.
                  </video>
                </div>
              );
            }
            return <img src={safeSrc} alt={safeAlt} {...props} />;
          },
          h1({ children, ...props }) {
            const text = extractText(children);
            const id = slugger(text);
            return (
              <h1 id={id} {...props}>
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            const text = extractText(children);
            const id = slugger(text);
            return (
              <h2 id={id} {...props}>
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            const text = extractText(children);
            const id = slugger(text);
            return (
              <h3 id={id} {...props}>
                {children}
              </h3>
            );
          },
          h4({ children, ...props }) {
            const text = extractText(children);
            const id = slugger(text);
            return (
              <h4 id={id} {...props}>
                {children}
              </h4>
            );
          },
          h5({ children, ...props }) {
            const text = extractText(children);
            const id = slugger(text);
            return (
              <h5 id={id} {...props}>
                {children}
              </h5>
            );
          },
          h6({ children, ...props }) {
            const text = extractText(children);
            const id = slugger(text);
            return (
              <h6 id={id} {...props}>
                {children}
              </h6>
            );
          },
          code({ className, children, ...props }) {
            const language = /language-(\w+)/.exec(className ?? "");
            if (language?.[1] === "mermaid") {
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
