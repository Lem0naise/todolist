import { SortableTodoItem } from "./SortableTodoItem";
import type { Todo } from "./utils";
import { effectiveCategory } from "./utils";

function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function CompletedSection({
  items,
  showCompleted,
  onToggleShow,
  onOpen,
  onToggleDone,
}: {
  items: Todo[];
  showCompleted: boolean;
  onToggleShow: () => void;
  onOpen: (todo: Todo) => void;
  onToggleDone: (todo: Todo) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="pt-3 border-t border-cream-200">
      <button
        onClick={onToggleShow}
        aria-expanded={showCompleted}
        className="text-xs font-bold tracking-wider uppercase text-stone-400 hover:text-stone-600 flex items-center gap-1.5 transition-colors"
      >
        <CaretIcon open={showCompleted} />
        {items.length} completed
      </button>
      {showCompleted && (
        <div className="space-y-1 mt-2 opacity-60">
          {items.map((todo) => (
            <SortableTodoItem
              key={todo._id}
              todo={todo}
              onOpen={() => onOpen(todo)}
              onToggleDone={() => onToggleDone(todo)}
              isCatchup={effectiveCategory(todo) === "lecture_catchup"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
