"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info";

export type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
};

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast };
};

export function ToastContainer({ toasts, removeToast }: { toasts: ToastMessage[], removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right-full fade-in duration-300 ${
            toast.type === "success" ? "bg-white dark:bg-slate-800 border-emerald-500 text-emerald-700 dark:text-emerald-400" :
            toast.type === "error" ? "bg-white dark:bg-slate-800 border-red-500 text-red-700 dark:text-red-400" :
            "bg-white dark:bg-slate-800 border-blue-500 text-blue-700 dark:text-blue-400"
          }`}
        >
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} className="opacity-50 hover:opacity-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
