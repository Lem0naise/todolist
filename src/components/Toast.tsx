import type { ToastMessage } from "../hooks/useToast";

export function ToastStack({ toasts }: { toasts: ToastMessage[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-24 sm:bottom-20 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-enter flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-sm font-bold ${
            t.tone === "success"
              ? "bg-mint-50 border-mint-200 text-mint-600"
              : "bg-white border-cream-200 text-stone-600"
          }`}
        >
          {t.tone === "success" && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {t.text}
        </div>
      ))}
    </div>
  );
}
