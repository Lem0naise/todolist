import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocalCache } from "../../hooks/useLocalCache";
import { useGuest } from "../../hooks/useGuestMode";
import { useGuestTodos } from "../../hooks/useGuestTodos";
import type { Id } from "../../../convex/_generated/dataModel";
import { TodoModal } from "./TodoModal";
import { FilterBar } from "./FilterBar";
import { CompletedSection } from "./CompletedSection";
import { SortableTodoItem } from "./SortableTodoItem";
import {
  CATEGORY_ORDER,
  CATEGORY_META,
  DEFAULT_FILTER,
  type FilterState,
  type Todo,
  type Module,
  type Category,
  effectiveCategory,
} from "./utils";

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

export function TodosView({ onNavigateToDate }: { onNavigateToDate?: (date: string) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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

  let pending = todos?.filter((t) => !t.completed) ?? [];
  const done = todos?.filter((t) => t.completed) ?? [];

  if (filter.moduleFilter !== "all") {
    pending = pending.filter((t) => t.moduleId === filter.moduleFilter);
  }
  if (filter.onlyHighPriority) {
    pending = pending.filter((t) => t.highPriority);
  }
  if (filter.onlyToday) {
    const today = new Date().toISOString().split("T")[0];
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

  const renderItem = (item: Todo, isCatchup = false) => (
    <SortableTodoItem
      key={item._id}
      todo={item}
      expanded={expanded.has(item._id)}
      onToggleExpand={() => toggleExpand(item._id)}
      onToggleDone={() => handleToggleDone(item)}
      onEdit={() => { setEditTodo(item); setShowModal(true); }}
      onDelete={() => handleDelete(item)}
      onNavigateToDate={onNavigateToDate}
      onSubTaskToggle={(stId) => handleSubTaskToggle(item, stId)}
      onProgressChange={(val) => handleProgressChange(item, val)}
      isCatchup={isCatchup}
    />
  );

  const groupedPending: Record<string, Todo[]> = {};
  for (const t of sorted) {
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

  const showKanban = filter.groupBy === "category" && categoryColumns.length >= 1;

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
      ) : sorted.length === 0 && done.length === 0 ? (
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
          {showKanban ? (
            <div className="min-h-[50vh] grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {categoryColumns.map(renderCategoryColumn)}
            </div>
          ) : filter.groupBy === "module"             ? (
            <div className="overflow-y-auto space-y-4">
              {Object.entries(
                sorted.reduce((acc, item) => {
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
          ) : (
            <div className="overflow-y-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={sorted.map((t) => t._id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {sorted.map((item) => renderItem(item))}
                  </div>
                </SortableContext>
              </DndContext>
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
              onNavigateToDate={onNavigateToDate}
              onSubTaskToggle={handleSubTaskToggle}
              onProgressChange={handleProgressChange}
            />
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
    </div>
  );
}
