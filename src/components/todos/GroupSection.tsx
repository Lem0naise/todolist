import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";

function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 flex-shrink-0 text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

/**
 * A group header that collapses its body. The body is unmounted while closed so
 * drag contexts and per-row work aren't created for hidden tasks.
 */
export function CollapsibleGroup({
  label,
  count,
  open,
  onToggle,
  right,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  labelClassName = "font-bold font-hand text-2xl text-lavender-500",
  countClassName = "bg-lavender-100 text-lavender-500",
  style,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  right?: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  labelClassName?: string;
  countClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const bodyId = useId();

  return (
    <section className={className} style={style}>
      <div className={`flex items-center gap-2 ${headerClassName}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <CaretIcon open={open} />
          <span className={`${labelClassName} truncate`}>{label}</span>
          <span
            className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-bold font-sans ${countClassName}`}
          >
            {count}
          </span>
        </button>
        {right && (
          <div className="ml-auto flex flex-shrink-0 items-center gap-0.5">{right}</div>
        )}
      </div>
      {open && (
        <div id={bodyId} className={bodyClassName}>
          {children}
        </div>
      )}
    </section>
  );
}
