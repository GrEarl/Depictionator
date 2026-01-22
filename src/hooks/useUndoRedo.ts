"use client";

import { useCallback, useRef, useState } from "react";
import { useKeyboardShortcut } from "./useKeyboardShortcut";

export type UndoRedoOptions = {
  maxHistory?: number;
  enableKeyboardShortcuts?: boolean;
};

export type UndoRedoState<T> = {
  current: T;
  canUndo: boolean;
  canRedo: boolean;
  push: (state: T) => void;
  undo: () => void;
  redo: () => void;
  reset: (initialState: T) => void;
  clear: () => void;
};

/**
 * A hook for managing undo/redo functionality.
 *
 * @example
 * const { current, push, undo, redo, canUndo, canRedo } = useUndoRedo(initialState);
 *
 * // When user makes a change:
 * push(newState);
 *
 * // Undo/Redo buttons:
 * <button onClick={undo} disabled={!canUndo}>Undo</button>
 * <button onClick={redo} disabled={!canRedo}>Redo</button>
 */
export function useUndoRedo<T>(
  initialState: T,
  options: UndoRedoOptions = {}
): UndoRedoState<T> {
  const { maxHistory = 50, enableKeyboardShortcuts = true } = options;

  // Use refs to store history to avoid re-renders on every push
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);

  // Current state is the main reactive state
  const [current, setCurrent] = useState<T>(initialState);

  // Force re-render trigger for canUndo/canRedo
  const [, setRenderTrigger] = useState(0);
  const triggerRender = useCallback(() => setRenderTrigger((n) => n + 1), []);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  /**
   * Push a new state onto the history stack.
   * This clears the redo stack (future states).
   */
  const push = useCallback(
    (newState: T) => {
      // Add current state to past
      pastRef.current = [...pastRef.current, current].slice(-maxHistory);
      // Clear future (redo stack)
      futureRef.current = [];
      // Set new current
      setCurrent(newState);
      triggerRender();
    },
    [current, maxHistory, triggerRender]
  );

  /**
   * Undo the last action.
   */
  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;

    const previous = pastRef.current[pastRef.current.length - 1];
    const newPast = pastRef.current.slice(0, -1);

    pastRef.current = newPast;
    futureRef.current = [current, ...futureRef.current];
    setCurrent(previous);
    triggerRender();
  }, [current, triggerRender]);

  /**
   * Redo the last undone action.
   */
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;

    const next = futureRef.current[0];
    const newFuture = futureRef.current.slice(1);

    pastRef.current = [...pastRef.current, current];
    futureRef.current = newFuture;
    setCurrent(next);
    triggerRender();
  }, [current, triggerRender]);

  /**
   * Reset the history with a new initial state.
   */
  const reset = useCallback(
    (newInitialState: T) => {
      pastRef.current = [];
      futureRef.current = [];
      setCurrent(newInitialState);
      triggerRender();
    },
    [triggerRender]
  );

  /**
   * Clear all history but keep current state.
   */
  const clear = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    triggerRender();
  }, [triggerRender]);

  // Keyboard shortcuts: Ctrl+Z for undo, Ctrl+Shift+Z or Ctrl+Y for redo
  useKeyboardShortcut(
    "z",
    () => {
      if (enableKeyboardShortcuts) {
        undo();
      }
    },
    { ctrl: true }
  );

  useKeyboardShortcut(
    "z",
    () => {
      if (enableKeyboardShortcuts) {
        redo();
      }
    },
    { ctrl: true, shift: true }
  );

  useKeyboardShortcut(
    "y",
    () => {
      if (enableKeyboardShortcuts) {
        redo();
      }
    },
    { ctrl: true }
  );

  return {
    current,
    canUndo,
    canRedo,
    push,
    undo,
    redo,
    reset,
    clear,
  };
}

/**
 * A simpler version that only tracks specific actions, not the full state.
 * Useful when you want to undo/redo specific operations.
 */
export type UndoableAction<T = unknown> = {
  type: string;
  data: T;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
};

export function useActionHistory(options: UndoRedoOptions = {}) {
  const { maxHistory = 50, enableKeyboardShortcuts = true } = options;

  const pastRef = useRef<UndoableAction[]>([]);
  const futureRef = useRef<UndoableAction[]>([]);
  const [, setRenderTrigger] = useState(0);
  const triggerRender = useCallback(() => setRenderTrigger((n) => n + 1), []);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const execute = useCallback(
    async (action: UndoableAction) => {
      await action.redo();
      pastRef.current = [...pastRef.current, action].slice(-maxHistory);
      futureRef.current = [];
      triggerRender();
    },
    [maxHistory, triggerRender]
  );

  const undo = useCallback(async () => {
    if (pastRef.current.length === 0) return;

    const action = pastRef.current[pastRef.current.length - 1];
    await action.undo();
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [action, ...futureRef.current];
    triggerRender();
  }, [triggerRender]);

  const redo = useCallback(async () => {
    if (futureRef.current.length === 0) return;

    const action = futureRef.current[0];
    await action.redo();
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, action];
    triggerRender();
  }, [triggerRender]);

  const clear = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    triggerRender();
  }, [triggerRender]);

  // Keyboard shortcuts
  useKeyboardShortcut(
    "z",
    () => {
      if (enableKeyboardShortcuts) {
        undo();
      }
    },
    { ctrl: true }
  );

  useKeyboardShortcut(
    "z",
    () => {
      if (enableKeyboardShortcuts) {
        redo();
      }
    },
    { ctrl: true, shift: true }
  );

  useKeyboardShortcut(
    "y",
    () => {
      if (enableKeyboardShortcuts) {
        redo();
      }
    },
    { ctrl: true }
  );

  return {
    canUndo,
    canRedo,
    execute,
    undo,
    redo,
    clear,
    history: pastRef.current,
  };
}
