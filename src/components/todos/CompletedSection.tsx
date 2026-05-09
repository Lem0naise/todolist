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
  expandedIds,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onDelete,
  onNavigateToDate,
  onSubTaskToggle,
  onProgressChange,
}: {
  items: Todo[];
  showCompleted: boolean;
  onToggleShow: () => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleDone: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onNavigateToDate?: (date: string) => void;
  onSubTaskToggle: (todo: Todo, stId: string) => void;
  onProgressChange: (todo: Todo, val: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="pt-3 border-t border-cream-200">
      <button
        onClick={onToggleShow}
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
              expanded={expandedIds.has(todo._id)}
              onToggleExpand={() => onToggleExpand(todo._id)}
              onToggleDone={() => onToggleDone(todo)}
              onEdit={() => onEdit(todo)}
              onDelete={() => onDelete(todo)}
              onNavigateToDate={onNavigateToDate}
              onSubTaskToggle={(stId) => onSubTaskToggle(todo, stId)}
              onProgressChange={(val) => onProgressChange(todo, val)}
              isCatchup={effectiveCategory(todo) === "lecture_catchup"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
