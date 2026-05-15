"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "info") => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {toasts.length > 0 ? (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                "px-4 py-2.5 text-[13px] border animate-in fade-in slide-in-from-bottom-2",
                "shadow-lg backdrop-blur-sm max-w-sm",
                t.type === "success" && "bg-surface border-accent/30 text-ink",
                t.type === "error" && "bg-surface border-red-500/40 text-red-300",
                t.type === "info" && "bg-surface border-rule-strong text-ink-soft"
              )}
              style={{ borderRadius: "var(--radius-card)" }}
            >
              <span className="mr-2">
                {t.type === "success" ? "✓" : t.type === "error" ? "✗" : "•"}
              </span>
              {t.message}
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
