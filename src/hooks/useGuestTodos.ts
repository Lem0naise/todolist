import { useState, useCallback } from "react";

const KEY = "unitrack:guest:todos";

type SubTask = { id: string; title: string; done: boolean };
type Category = "project" | "lecture_catchup" | "other";

interface GuestTodo {
  _id: string;
  title: string;
  description?: string;
  dueDate?: string;
  highPriority: boolean;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  category?: Category;
  subTasks?: SubTask[];
  manualProgress?: number;
  moduleName?: string;
  manualOrder?: number;
}

function loadTodos(): GuestTodo[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTodos(todos: GuestTodo[]) {
  localStorage.setItem(KEY, JSON.stringify(todos));
}

export function useGuestTodos(active: boolean) {
  const [todos, setTodos] = useState<GuestTodo[]>(() => loadTodos());

  const create = useCallback((data: Partial<GuestTodo>) => {
    if (!active) return;
    const todo: GuestTodo = {
      _id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      title: data.title || "",
      description: data.description,
      dueDate: data.dueDate,
      highPriority: data.highPriority || false,
      completed: false,
      createdAt: Date.now(),
      category: data.category || "other",
      subTasks: data.subTasks,
      manualProgress: data.manualProgress,
      moduleName: data.moduleName,
      manualOrder: data.manualOrder,
    };
    setTodos((prev) => {
      const next = [todo, ...prev];
      saveTodos(next);
      return next;
    });
  }, [active]);

  const update = useCallback((id: string, data: Partial<GuestTodo>) => {
    if (!active) return;
    setTodos((prev) => {
      const next = prev.map((t) => (t._id === id ? { ...t, ...data } : t));
      saveTodos(next);
      return next;
    });
  }, [active]);

  const complete = useCallback((id: string, completed: boolean) => {
    if (!active) return;
    setTodos((prev) => {
      const next = prev.map((t) =>
        t._id === id ? { ...t, completed, completedAt: completed ? Date.now() : undefined } : t,
      );
      saveTodos(next);
      return next;
    });
  }, [active]);

  const remove = useCallback((id: string) => {
    if (!active) return;
    setTodos((prev) => {
      const next = prev.filter((t) => t._id !== id);
      saveTodos(next);
      return next;
    });
  }, [active]);

  const reorder = useCallback((_updates: { id: string; manualOrder: number }[]) => {
    if (!active) return;
    setTodos((prev) => {
      const next = prev.map((t) => {
        const update = _updates.find((u) => u.id === t._id);
        return update ? { ...t, manualOrder: update.manualOrder } : t;
      });
      saveTodos(next);
      return next;
    });
  }, [active]);

  const updateSubTasks = useCallback((id: string, subTasks: SubTask[]) => {
    if (!active) return;
    setTodos((prev) => {
      const next = prev.map((t) => (t._id === id ? { ...t, subTasks } : t));
      saveTodos(next);
      return next;
    });
  }, [active]);

  const updateProgress = useCallback((id: string, manualProgress: number) => {
    if (!active) return;
    setTodos((prev) => {
      const next = prev.map((t) => (t._id === id ? { ...t, manualProgress } : t));
      saveTodos(next);
      return next;
    });
  }, [active]);

  return {
    todos: active ? todos : [],
    create,
    update,
    complete,
    remove,
    reorder,
    updateSubTasks,
    updateProgress,
  };
}
