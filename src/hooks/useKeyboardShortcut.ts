"use client";

import { useEffect } from "react";

export function useKeyboardShortcut(
  key: string,
  callback: (event?: KeyboardEvent) => void,
  options: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean; allowInInput?: boolean } = {}
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      if (
        !options.allowInInput &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const keyMatch = event.key.toLowerCase() === key.toLowerCase();
      const ctrlMatch = !!options.ctrl === (event.ctrlKey || event.metaKey); // Treat meta (cmd) as ctrl for mac
      const shiftMatch = !!options.shift === event.shiftKey;
      const altMatch = !!options.alt === event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        callback(event);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback, options]);
}
