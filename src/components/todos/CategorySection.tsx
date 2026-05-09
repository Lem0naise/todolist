import type { Category } from "./utils";
import { CATEGORY_META, type Todo } from "./utils";
import { SortableTodoItem } from "./SortableTodoItem";
import type { SortMode } from "./utils";

function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function CategorySection({
  category,
  items,
  collapsed,
  onToggleCollapse,
  sortMode,
  onSetSort,
  expandedIds,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onDelete,
  onNavigateToDate,
  onSubTaskToggle,
  onProgressChange,
  isCatchup,
}: {
  category: Category;
  items: Todo[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  sortMode: SortMode;
  onSetSort: (s: SortMode) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleDone: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onNavigateToDate?: (date: string) => void;
  onSubTaskToggle: (todo: Todo, stId: string) => void;
  onProgressChange: (todo: Todo, val: number) => void;
  isCatchup?: boolean;
}) {
  if (items.length === 0) return null;
  const meta = CATEGORY_META[category];

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-1.5 font-bold tracking-wide"
        >
          <CaretIcon open={!collapsed} />
          <span className={`text-xs uppercase font-hand text-lg ${meta.color}`}>
            {meta.label}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${meta.color} ${meta.bg}`}>
            {items.length}
          </span>
        </button>

        <div className="ml-auto flex items-center gap-0.5">
          {!isCatchup && (
            <button
              onClick={() => onSetSort("manual")}
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${
                sortMode === "manual"
                  ? "bg-stone-200 text-stone-700"
                  : "text-stone-400 hover:bg-stone-100"
              }`}
            >
              M
            </button>
          )}
          <button
            onClick={() => onSetSort("dueDateAsc")}
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${
              sortMode === "dueDateAsc"
                ? "bg-stone-200 text-stone-700"
                : "text-stone-400 hover:bg-stone-100"
            }`}
          >
            +
          </button>
          <button
            onClick={() => onSetSort("dueDateDesc")}
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${
              sortMode === "dueDateDesc"
                ? "bg-stone-200 text-stone-700"
                : "text-stone-400 hover:bg-stone-100"
            }`}
          >
            -
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-1">
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
              isCatchup={isCatchup}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ModuleGroupSection({
  moduleName,
  moduleColor,
  items,
  expandedIds,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onDelete,
  onNavigateToDate,
  onSubTaskToggle,
  onProgressChange,
}: {
  moduleName: string;
  moduleColor?: string;
  items: Todo[];
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
    <div className="space-y-1 pl-3" style={moduleColor ? { borderLeft: `3px solid ${moduleColor}` } : { borderLeft: "3px solid #c4b5e3" }}>
      <h4
        className="text-xs font-bold text-lavender-600 font-hand text-lg"
      >
        {moduleName}
        <span className="ml-2 text-[10px] px-1 py-0.5 bg-lavender-100 rounded text-lavender-500 font-sans">
          {items.length}
        </span>
      </h4>
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
          isCatchup={true}
        />
      ))}
    </div>
  );
}
