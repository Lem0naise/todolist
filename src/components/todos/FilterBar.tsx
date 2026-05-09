import type { Module } from "./utils";
import type { FilterState } from "./utils";

function FilterBarIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

export function FilterBar({
  filter,
  onChange,
  modules,
  activeCount,
  onResetModuleFilter,
}: {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  modules: Module[];
  activeCount: number;
  onResetModuleFilter: () => void;
}) {
  const update = (partial: Partial<FilterState>) => onChange({ ...filter, ...partial });

  return (
    <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold uppercase tracking-wider">
      <span className="text-stone-400 flex items-center gap-1">
        <FilterBarIcon />
        Sort
      </span>
      <button
        onClick={() => update({ sort: "manual" })}
        className={`px-2 py-1 rounded font-bold transition-colors ${
          filter.sort === "manual"
            ? "bg-rose-100 text-rose-600"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
        }`}
      >
        Manual
      </button>
      <button
        onClick={() => update({ sort: "dueDateAsc" })}
        className={`px-2 py-1 rounded font-bold transition-colors ${
          filter.sort === "dueDateAsc"
            ? "bg-rose-100 text-rose-600"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
        }`}
      >
        Date +
      </button>
      <button
        onClick={() => update({ sort: "dueDateDesc" })}
        className={`px-2 py-1 rounded font-bold transition-colors ${
          filter.sort === "dueDateDesc"
            ? "bg-rose-100 text-rose-600"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
        }`}
      >
        Date -
      </button>

      <span className="text-stone-300 mx-1">|</span>

      <span className="text-stone-400 flex items-center gap-1">
        Group
      </span>
      <button
        onClick={() => update({ groupBy: "category" })}
        className={`px-2 py-1 rounded font-bold transition-colors ${
          filter.groupBy === "category"
            ? "bg-lavender-100 text-lavender-600"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
        }`}
      >
        Category
      </button>
      <button
        onClick={() => update({ groupBy: "module" })}
        className={`px-2 py-1 rounded font-bold transition-colors ${
          filter.groupBy === "module"
            ? "bg-lavender-100 text-lavender-600"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
        }`}
      >
        Module
      </button>
      <button
        onClick={() => update({ groupBy: "none" })}
        className={`px-2 py-1 rounded font-bold transition-colors ${
          filter.groupBy === "none"
            ? "bg-lavender-100 text-lavender-600"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
        }`}
      >
        Flat
      </button>

      {modules.length > 0 && (
        <>
          <span className="text-stone-300 mx-1">|</span>
          <span className="text-stone-400">Module</span>
          <button
            onClick={onResetModuleFilter}
            className={`px-2 py-1 rounded font-bold transition-colors ${
              filter.moduleFilter === "all"
                ? "bg-mint-100 text-mint-600"
                : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}
          >
            All
          </button>
          {modules.map((mod) => (
            <button
              key={mod._id}
              onClick={() => update({ moduleFilter: mod._id })}
              className={`px-2 py-1 rounded font-bold transition-colors ${
                filter.moduleFilter === mod._id
                  ? "bg-lavender-100 text-lavender-600 ring-1 ring-lavender-300"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200"
              }`}
            >
              {mod.name}
            </button>
          ))}
        </>
      )}

      <span className="text-stone-300 mx-1">|</span>
      <button
        onClick={() => update({ onlyHighPriority: !filter.onlyHighPriority })}
        className={`px-2 py-1 rounded font-bold transition-colors ${
          filter.onlyHighPriority
            ? "bg-rose-100 text-rose-600"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
        }`}
      >
        Priority
      </button>
      <button
        onClick={() => update({ onlyToday: !filter.onlyToday })}
        className={`px-2 py-1 rounded font-bold transition-colors ${
          filter.onlyToday
            ? "bg-amber-100 text-amber-700"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
        }`}
      >
        Today
      </button>

      <span className="text-stone-400 ml-auto">{activeCount} items</span>
    </div>
  );
}
