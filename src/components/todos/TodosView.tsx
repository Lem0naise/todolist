import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocalCache } from "../../hooks/useLocalCache";
import { useGuest } from "../../hooks/useGuestMode";
import { useGuestTodos, type BulkEdit } from "../../hooks/useGuestTodos";
import { addDaysLocal, getTodayLocal, startOfWeekLocal } from "../../lib/date";
import type { Id } from "../../../convex/_generated/dataModel";
import { TodoModal } from "./TodoModal";
import { FilterBar } from "./FilterBar";
import { CompletedSection } from "./CompletedSection";
import { SortableTodoItem } from "./SortableTodoItem";
import {
  CATEGORY_ORDER,
  CATEGORY_META,
  DEFAULT_FILTER,
  isFocusToday,
  SNOOZE_PRESETS,
  type FilterState,
  type Todo,
  type Module,
  type Category,
  effectiveCategory,
} from "./utils";
import type { StartableTask } from "../pomo/startForTask";
import { ToastStack } from "../Toast";
import { useToast } from "../../hooks/useToast";
import { SunIcon } from "../icons";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

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

export function TodosView({
  onStartPomo,
}: {
  onStartPomo?: (task: StartableTask) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState("");
  const { toasts, push } = useToast();
  const [filter, setFilter] = useState<FilterState>(() => {
    try {
      const saved = localStorage.getItem("unitrack:filter");
      if (saved) return { ...DEFAULT_FILTER, ...JSON.parse(saved) };
    } catch {
      /* ignore parse errors */
    }
    return DEFAULT_FILTER;
  });

  useEffect(() => {
    localStorage.setItem("unitrack:filter", JSON.stringify(filter));
  }, [filter]);

  const { isGuest } = useGuest();

  const modulesQuery = useQuery(api.modules.list);
  const modules = useLocalCache<Module[]>("modules", modulesQuery) as Module[] | null | undefined;

  const liveTodos = useQuery(api.todos.list, { includeCompleted: true });
  const cachedTodos = useLocalCache<Todo[]>("todos:all", liveTodos) as Todo[] | null | undefined;

  const guestTodoData = useGuestTodos(isGuest);

  const todos: Todo[] | null | undefined = isGuest
    ? (guestTodoData.todos as unknown as Todo[])
    : cachedTodos;

  const completeTodo = useMutation(api.todos.complete);
  const _removeTodo = useMutation(api.todos.remove);
  const _updateSubTasks = useMutation(api.todos.updateSubTasks);
  const _updateProgress = useMutation(api.todos.updateProgress);
  const reorderMutation = useMutation(api.todos.reorder);
  const setFocusMutation = useMutation(api.todos.setFocus);
  const reorderFocusMutation = useMutation(api.todos.reorderFocus);
  const snoozeMutation = useMutation(api.todos.snooze);
  const bulkUpdateMutation = useMutation(api.todos.bulkUpdate);
  const bulkRemoveMutation = useMutation(api.todos.bulkRemove);

  // Guest-compatible CRUD callbacks
  const handleComplete = (id: string, completed: boolean) => {
    if (isGuest) {
      guestTodoData.complete(id, completed);
    } else {
      completeTodo({ id: id as Id<"todos">, completed });
    }
  };

  const handleRemove = (id: string) => {
    if (isGuest) {
      guestTodoData.remove(id);
    } else {
      _removeTodo({ id: id as Id<"todos"> });
    }
  };

  const handleSubTaskUpdate = (id: string, subTasks: { id: string; title: string; done: boolean }[]) => {
    if (isGuest) {
      guestTodoData.updateSubTasks(id, subTasks);
    } else {
      _updateSubTasks({ id: id as Id<"todos">, subTasks });
    }
  };

  const handleProgressUpdate = (id: string, manualProgress: number) => {
    if (isGuest) {
      guestTodoData.updateProgress(id, manualProgress);
    } else {
      _updateProgress({ id: id as Id<"todos">, manualProgress });
    }
  };

  const handleReorder = (updates: { id: string; manualOrder: number }[]) => {
    if (isGuest) {
      guestTodoData.reorder(updates);
    } else {
      reorderMutation({ updates: updates as { id: Id<"todos">; manualOrder: number }[] });
    }
  };

  const handleSetFocus = (id: string, focusDate?: string) => {
    if (isGuest) {
      guestTodoData.setFocus(id, focusDate);
    } else {
      setFocusMutation({ id: id as Id<"todos">, focusDate });
    }
  };

  const handleReorderFocus = (updates: { id: string; focusOrder: number }[]) => {
    if (isGuest) {
      guestTodoData.reorderFocus(updates);
    } else {
      reorderFocusMutation({
        updates: updates as { id: Id<"todos">; focusOrder: number }[],
      });
    }
  };

  const handleSnooze = (id: string, until?: string) => {
    if (isGuest) {
      guestTodoData.snooze(id, until);
    } else {
      snoozeMutation({ id: id as Id<"todos">, until });
    }
  };

  const handleBulkUpdate = (edits: BulkEdit[]) => {
    if (isGuest) {
      guestTodoData.bulkUpdate(edits);
    } else {
      bulkUpdateMutation({
        updates: edits as (Omit<BulkEdit, "id"> & { id: Id<"todos"> })[],
      });
    }
  };

  const handleBulkRemove = (ids: string[]) => {
    if (isGuest) {
      guestTodoData.bulkRemove(ids);
    } else {
      bulkRemoveMutation({ ids: ids as Id<"todos">[] });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.key === "n" || e.key === "N") && !showModal) {
        e.preventDefault();
        setEditTodo(null);
        setShowModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && todos) {
      const items = todos.filter((t) => !t.completed);
      const oldIndex = items.findIndex((t) => t._id === active.id);
      const newIndex = items.findIndex((t) => t._id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(items, oldIndex, newIndex);
      handleReorder(
        newOrder.map((t, idx) => ({ id: t._id, manualOrder: idx })),
      );
    }
  };

  const handleFocusDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = myDay.findIndex((t) => t._id === active.id);
    const newIndex = myDay.findIndex((t) => t._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(myDay, oldIndex, newIndex);
    handleReorderFocus(newOrder.map((t, idx) => ({ id: t._id, focusOrder: idx })));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const selectAll = (ids: string[]) => setSelected(new Set(ids));

  const clearMyDay = () => {
    if (myDay.length === 0) return;
    handleBulkUpdate(myDay.map((t) => ({ id: t._id, focusDate: null })));
  };

  const selectedIds = [...selected];
  const applyToSelected = (fields: Omit<BulkEdit, "id">) => {
    handleBulkUpdate(selectedIds.map((id) => ({ id, ...fields })));
  };
  const deleteSelected = () => {
    if (confirm(`Delete ${selected.size} task${selected.size !== 1 ? "s" : ""}?`)) {
      handleBulkRemove(selectedIds);
      exitSelect();
    }
  };

  let pending = todos?.filter((t) => !t.completed) ?? [];
  const done = (todos?.filter((t) => t.completed) ?? []).sort(
    (a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt),
  );

  const today = getTodayLocal();

  if (filter.moduleFilter !== "all") {
    pending = pending.filter((t) => t.moduleId === filter.moduleFilter);
  }
  if (filter.onlyHighPriority) {
    pending = pending.filter((t) => t.highPriority);
  }
  if (filter.onlyToday) {
    pending = pending.filter((t) => t.dueDate === today);
  }

  const sortItems = (items: Todo[]) => {
    if (filter.sort === "manual") return items;
    return [...items].sort((a, b) => {
      const dateA = a.dueDate ?? "9999-12-31";
      const dateB = b.dueDate ?? "9999-12-31";
      if (filter.sort === "dueDateAsc") return dateA.localeCompare(dateB);
      return dateB.localeCompare(dateA);
    });
  };

  const sorted = sortItems(pending);

  const pendingAll = todos?.filter((t) => !t.completed) ?? [];
  const myDay = pendingAll
    .filter((t) => isFocusToday(t, today))
    .sort((a, b) => (a.focusOrder ?? 0) - (b.focusOrder ?? 0));
  const backlogSorted = sorted.filter((t) => !isFocusToday(t, today));

  const usedModuleIds = new Set<string>();
  for (const t of sorted) {
    if (t.moduleId) usedModuleIds.add(t.moduleId);
  }

  const availableModules = (modules ?? []).filter((m) => usedModuleIds.has(m._id));

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleDone = (todo: Todo) => {
    handleComplete(todo._id, !todo.completed);
    if (!todo.completed) push("Task completed");
  };

  const handleDelete = (todo: Todo) => {
    if (confirm("Delete this task?")) handleRemove(todo._id);
  };

  const handleSubTaskToggle = (todo: Todo, stId: string) => {
    if (!todo.subTasks) return;
    const updated = todo.subTasks.map((s) =>
      s.id === stId ? { ...s, done: !s.done } : s,
    );
    handleSubTaskUpdate(todo._id, updated);
  };

  const handleProgressChange = (todo: Todo, val: number) => {
    handleProgressUpdate(todo._id, val);
  };

  const renderItem = (item: Todo, isCatchup = false, showPomo = false) => {
    const focused = isFocusToday(item, today);
    return (
      <SortableTodoItem
        key={item._id}
        todo={item}
        expanded={expanded.has(item._id)}
        onToggleExpand={() => toggleExpand(item._id)}
        onToggleDone={() => handleToggleDone(item)}
        onEdit={() => { setEditTodo(item); setShowModal(true); }}
        onDelete={() => handleDelete(item)}
        onSubTaskToggle={(stId) => handleSubTaskToggle(item, stId)}
        onProgressChange={(val) => handleProgressChange(item, val)}
        isCatchup={isCatchup}
        isFocus={focused}
        onToggleFocus={() => handleSetFocus(item._id, focused ? undefined : today)}
        onSnooze={(until) => handleSnooze(item._id, until)}
        onStartPomo={
          showPomo && onStartPomo
            ? () =>
                onStartPomo({
                  _id: item._id,
                  title: item.title,
                  moduleName: item.moduleName,
                })
            : undefined
        }
        selectable={selectMode}
        selected={selected.has(item._id)}
        onSelect={() => toggleSelect(item._id)}
      />
    );
  };

  const groupedPending: Record<string, Todo[]> = {};
  for (const t of backlogSorted) {
    const cat = effectiveCategory(t);
    if (!groupedPending[cat]) groupedPending[cat] = [];
    groupedPending[cat].push(t);
  }

  const categoryColumns = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: groupedPending[cat] ?? [],
    meta: CATEGORY_META[cat],
    isCatchup: cat === "lecture_catchup",
  })).filter((col) => col.items.length > 0);

  const renderCategoryColumn = (cat: (typeof categoryColumns)[0]) => {
    const { items, meta, isCatchup } = cat;
    const isCollapsed = collapsed.has(cat.cat);

    return (
      <div key={cat.cat} className="flex flex-col min-h-0 bg-white/40 rounded-xl border border-cream-200">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-cream-100 flex-shrink-0">
          <button
            onClick={() => toggleCollapse(cat.cat)}
            className="flex items-center gap-1.5 font-bold tracking-wide"
          >
            <CaretIcon open={!isCollapsed} />
            <span className={`text-2xl uppercase font-hand text-2xl ${meta.color}`}>
              {meta.label}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold font-sans ${meta.color} ${meta.bg}`}>
              {items.length}
            </span>
          </button>
          <div className="ml-auto flex items-center gap-0.5">
            {!isCatchup && (
              <button
                onClick={() => setFilter({ ...filter, sort: "manual" })}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${
                  filter.sort === "manual" ? "bg-stone-200 text-stone-700" : "text-stone-400 hover:bg-stone-100"
                }`}
              >
                M
              </button>
            )}
            <button
              onClick={() => setFilter({ ...filter, sort: "dueDateAsc" })}
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${
                filter.sort === "dueDateAsc" ? "bg-stone-200 text-stone-700" : "text-stone-400 hover:bg-stone-100"
              }`}
            >
              +
            </button>
            <button
              onClick={() => setFilter({ ...filter, sort: "dueDateDesc" })}
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${
                filter.sort === "dueDateDesc" ? "bg-stone-200 text-stone-700" : "text-stone-400 hover:bg-stone-100"
              }`}
            >
              &minus;
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
            {isCatchup ? (
              <>
                {Object.entries(
                  items.reduce((acc, item) => {
                    const key = item.moduleName || "Other";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {} as Record<string, Todo[]>)
                )
                  .sort(([a], [b]) => {
                    if (a === "Other") return 1;
                    if (b === "Other") return -1;
                    return a.localeCompare(b);
                  })
                  .map(([moduleName, moduleItems]) => {
                    const mod = (modules ?? []).find((m) => m.name === moduleName);
                    return (
                      <div key={moduleName} className="space-y-1 pl-2" style={mod?.color ? { borderLeft: `3px solid ${mod.color}` } : { borderLeft: "3px solid #c4b5e3" }}>
                        <h4 className="text-xs font-bold text-lavender-500 font-hand text-lg pl-1">
                          {moduleName}
                        </h4>
                        {moduleItems.map((item) => renderItem(item, true))}
                      </div>
                    );
                  })}
              </>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={items.map((t) => t._id)} strategy={verticalListSortingStrategy}>
                  {items.map((item) => renderItem(item))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}
      </div>
    );
  };

  const formatWeekLabel = (weekStart: string) =>
    `Week of ${new Date(weekStart + "T12:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    })}`;

  const dateGroups = (() => {
    if (filter.groupBy !== "date") return [];
    const today = getTodayLocal();
    const thisMonday = startOfWeekLocal(today);
    const nextMonday = addDaysLocal(thisMonday, 7);

    const buckets = new Map<string, { label: string; order: number; items: Todo[] }>();

    for (const item of backlogSorted) {
      let key: string;
      let label: string;
      let order: number;

      if (!item.dueDate) {
        key = "no-date";
        label = "No date";
        order = 100000;
      } else if (item.dueDate < today) {
        key = "overdue";
        label = "Overdue";
        order = -2;
      } else if (item.dueDate === today) {
        key = "today";
        label = "Today";
        order = -1;
      } else if (item.dueDate === addDaysLocal(today, 1)) {
        key = "tomorrow";
        label = "Tomorrow";
        order = 0;
      } else {
        const weekStart = startOfWeekLocal(item.dueDate);
        if (weekStart === thisMonday) {
          key = "this-week";
          label = "This week";
          order = 1;
        } else if (weekStart === nextMonday) {
          key = "next-week";
          label = "Next week";
          order = 2;
        } else {
          key = `week-${weekStart}`;
          label = formatWeekLabel(weekStart);
          const diffDays = Math.round(
            (new Date(weekStart + "T12:00:00").getTime() -
              new Date(thisMonday + "T12:00:00").getTime()) /
              86400000,
          );
          order = 3 + diffDays;
        }
      }

      if (!buckets.has(key)) buckets.set(key, { label, order, items: [] });
      buckets.get(key)!.items.push(item);
    }

    return [...buckets.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, bucket]) => ({
        key,
        label: bucket.label,
        items: [...bucket.items].sort((x, y) =>
          (x.dueDate ?? "9999-12-31").localeCompare(y.dueDate ?? "9999-12-31"),
        ),
      }));
  })();

  const showKanban = filter.groupBy === "category" && categoryColumns.length >= 1;
  const showBacklog = backlogOpen || myDay.length === 0;

  return (
    <div className="p-3 max-w-[90rem] mx-auto pb-24">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 font-hand text-4xl leading-tight">
            to-do
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            {sorted.length} item{sorted.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <button
                onClick={() => selectAll([...myDay, ...backlogSorted].map((t) => t._id))}
                className="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-cream-100 text-stone-500 hover:bg-cream-200 transition-colors"
              >
                Select all
              </button>
              <button
                onClick={exitSelect}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-stone-700 text-white hover:bg-stone-800 transition-colors"
              >
                Done ({selected.size})
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectMode(true)}
                className="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-cream-100 text-stone-500 hover:bg-cream-200 transition-colors"
              >
                Select
              </button>
              <button
                onClick={() => { setEditTodo(null); setShowModal(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-400 hover:bg-rose-500 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New
                <span className="hidden sm:inline-block ml-1 opacity-60 text-[10px] uppercase font-bold tracking-wider">N</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-3 flex-shrink-0">
        <FilterBar
          filter={filter}
          onChange={setFilter}
          modules={availableModules}
          activeCount={sorted.length}
          onResetModuleFilter={() => setFilter({ ...filter, moduleFilter: "all" })}
        />
      </div>

      {todos === undefined ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pendingAll.length === 0 && done.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-stone-400">
          <div>
            <svg className="w-16 h-16 mx-auto text-mint-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-hand font-bold text-stone-400">all caught up!</p>
            <p className="text-xs mt-1">Press <kbd className="px-1.5 py-0.5 bg-cream-100 rounded font-mono text-[10px]">N</kbd> to add a task</p>
          </div>
        </div>
      ) : (
        <div className="min-h-0">
          {myDay.length > 0 && (
            <section className="mb-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-100 flex-shrink-0">
                  <SunIcon className="w-4 h-4 text-amber-500" />
                  <h3 className="font-hand text-2xl text-amber-700">my day</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold font-sans bg-amber-100 text-amber-700">
                    {myDay.length}
                  </span>
                  <button
                    onClick={clearMyDay}
                    className="ml-auto text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:text-amber-700 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleFocusDragEnd}
                  >
                    <SortableContext
                      items={myDay.map((t) => t._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {myDay.map((item) =>
                        renderItem(
                          item,
                          effectiveCategory(item) === "lecture_catchup",
                          true,
                        ),
                      )}
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            </section>
          )}

          {backlogSorted.length > 0 && (
            <div>
              {myDay.length > 0 ? (
                <button
                  onClick={() => setBacklogOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-400 hover:text-stone-600 transition-colors"
                >
                  <CaretIcon open={showBacklog} />
                  All tasks
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream-200 text-stone-500">
                    {backlogSorted.length}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">
                  All tasks
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream-200 text-stone-500">
                    {backlogSorted.length}
                  </span>
                </div>
              )}
              <div className={showBacklog ? "mt-3" : "hidden"}>
          {showKanban ? (
            <div className="min-h-[50vh] grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {categoryColumns.map(renderCategoryColumn)}
            </div>
          ) : filter.groupBy === "module"             ? (
            <div className="overflow-y-auto space-y-4">
              {Object.entries(
                backlogSorted.reduce((acc, item) => {
                  const key = item.moduleName || "Other";
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(item);
                  return acc;
                }, {} as Record<string, Todo[]>)
              )
                .sort(([a], [b]) => {
                  if (a === "Other") return 1;
                  if (b === "Other") return -1;
                  return a.localeCompare(b);
                })
                .map(([moduleName, moduleItems]) => {
                  const mod = (modules ?? []).find((m) => m.name === moduleName);
                  return (
                    <div key={moduleName} className="space-y-1 pl-3" style={mod?.color ? { borderLeft: `3px solid ${mod.color}` } : { borderLeft: "3px solid #c4b5e3" }}>
                      <h4 className="text-sm font-bold text-lavender-500 font-hand text-2xl">
                        {moduleName}
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-lavender-100 rounded text-lavender-500 font-sans">
                          {moduleItems.length}
                        </span>
                      </h4>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext items={moduleItems.map((t) => t._id)} strategy={verticalListSortingStrategy}>
                        {moduleItems.map((item) => renderItem(item, effectiveCategory(item) === "lecture_catchup"))}
                      </SortableContext>
                    </DndContext>
                    </div>
                  );
                })}
            </div>
          ) : filter.groupBy === "date" ? (
            <div className="overflow-y-auto space-y-4">
              {dateGroups.map((group) => (
                <div
                  key={group.key}
                  className="space-y-1 pl-3"
                  style={{ borderLeft: "3px solid #c4b5e3" }}
                >
                  <h4 className="text-sm font-bold text-lavender-500 font-hand text-2xl">
                    {group.label}
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-lavender-100 rounded text-lavender-500 font-sans">
                      {group.items.length}
                    </span>
                  </h4>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={group.items.map((t) => t._id)} strategy={verticalListSortingStrategy}>
                      {group.items.map((item) =>
                        renderItem(item, effectiveCategory(item) === "lecture_catchup"),
                      )}
                    </SortableContext>
                  </DndContext>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-y-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={backlogSorted.map((t) => t._id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {backlogSorted.map((item) => renderItem(item))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
              </div>
            </div>
          )}

          <div className="flex-shrink-0 mt-4">
            <CompletedSection
              items={done}
              showCompleted={filter.showCompleted}
              onToggleShow={() => setFilter({ ...filter, showCompleted: !filter.showCompleted })}
              expandedIds={expanded}
              onToggleExpand={toggleExpand}
              onToggleDone={handleToggleDone}
              onEdit={(t) => { setEditTodo(t); setShowModal(true); }}
              onDelete={handleDelete}
              onSubTaskToggle={handleSubTaskToggle}
              onProgressChange={handleProgressChange}
            />
          </div>
        </div>
      )}

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(56rem,calc(100%-1.5rem))]">
          <div className="bg-white border border-cream-200 rounded-2xl shadow-xl p-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
            <span className="text-stone-500 mr-1 normal-case tracking-normal text-xs">
              {selected.size} selected
            </span>

            <input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              className="px-2 py-1 rounded-lg border border-cream-200 bg-white text-stone-600 font-semibold normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <button
              onClick={() => bulkDate && applyToSelected({ dueDate: bulkDate })}
              disabled={!bulkDate}
              className="px-2 py-1 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 disabled:opacity-40 transition-colors"
            >
              Set due
            </button>
            <button
              onClick={() => applyToSelected({ dueDate: null })}
              className="px-2 py-1 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
            >
              Clear date
            </button>

            <span className="text-stone-200">|</span>

            {SNOOZE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyToSelected({ snoozedUntil: addDaysLocal(today, p.days) })}
                className="px-2 py-1 rounded-lg bg-lavender-100 text-lavender-600 hover:bg-lavender-200 transition-colors"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => applyToSelected({ snoozedUntil: null })}
              className="px-2 py-1 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
            >
              Unsnooze
            </button>

            <span className="text-stone-200">|</span>

            <button
              onClick={() => applyToSelected({ highPriority: true })}
              className="px-2 py-1 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors"
            >
              Priority +
            </button>
            <button
              onClick={() => applyToSelected({ highPriority: false })}
              className="px-2 py-1 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
            >
              Priority −
            </button>

            <span className="text-stone-200">|</span>

            {(["project", "other", "lecture_catchup"] as Category[]).map((c) => (
              <button
                key={c}
                onClick={() => applyToSelected({ category: c })}
                className="px-2 py-1 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
              >
                {CATEGORY_META[c].label}
              </button>
            ))}

            <button
              onClick={deleteSelected}
              className="ml-auto px-2 py-1 rounded-lg bg-rose-400 text-white hover:bg-rose-500 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <TodoModal
          onClose={() => { setShowModal(false); setEditTodo(null); }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editTodo={editTodo as any}
          isGuest={isGuest}
          onGuestCreate={isGuest ? (data: Record<string, unknown>) => {
            guestTodoData.create({
              title: data.title as string,
              description: data.description as string,
              dueDate: data.dueDate as string,
              highPriority: data.highPriority as boolean,
              category: data.category as Category,
              subTasks: data.subTasks as { id: string; title: string; done: boolean }[],
              manualProgress: data.manualProgress as number,
            });
          } : undefined}
          onGuestUpdate={isGuest ? (id: string, data: Record<string, unknown>) => {
            guestTodoData.update(id, {
              title: data.title as string,
              description: data.description as string,
              dueDate: data.dueDate as string,
              highPriority: data.highPriority as boolean,
              category: data.category as Category,
              subTasks: data.subTasks as { id: string; title: string; done: boolean }[],
              manualProgress: data.manualProgress as number,
            });
          } : undefined}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}
