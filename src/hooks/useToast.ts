import { useCallback, useRef, useState } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  tone: "success" | "info";
}

/** Tiny self-expiring toast queue. */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const seq = useRef(0);

  const push = useCallback((text: string, tone: "success" | "info" = "success") => {
    const id = ++seq.current;
    setToasts((prev) => [...prev, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  }, []);

  return { toasts, push };
}
