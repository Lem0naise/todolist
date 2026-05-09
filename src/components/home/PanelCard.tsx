import type { ReactNode } from "react";

export function PanelCard({
  title,
  icon,
  badge,
  action,
  headerAction,
  isFullHeight = false,
  children,
}: {
  title: string;
  icon: ReactNode;
  badge?: string;
  action?: { label: string; onClick: () => void };
  headerAction?: ReactNode;
  isFullHeight?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-cream-200 flex flex-col overflow-hidden shadow-sm ${
        isFullHeight ? "h-full" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-cream-100 bg-cream-50/50 h-[48px] flex-none">
        <span className="p-1 bg-cream-100 rounded-lg">{icon}</span>
        <h2 className="text-base font-bold text-stone-700 font-hand text-2xl">{title}</h2>
        {badge && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-cream-200 text-stone-500 rounded font-bold ml-1">
            {badge}
          </span>
        )}
        <div className="flex-1" />
        {headerAction}
        {action && (
          <button
            onClick={action.onClick}
            className="text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-stone-700 transition-colors ml-1 px-2 py-1 rounded hover:bg-cream-100"
          >
            {action.label}
          </button>
        )}
      </div>
      <div
        className={`flex-1 p-3 overflow-y-auto ${!isFullHeight ? "max-h-[400px]" : "min-h-0"}`}
      >
        {children}
      </div>
    </div>
  );
}
