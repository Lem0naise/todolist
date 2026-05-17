import { useState, useEffect, useRef } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { Auth } from "./components/Auth";
import { Nav } from "./components/Nav";
import type { Tab } from "./components/Nav";
import { CombinedView } from "./components/home/CombinedView";
import { TodayView } from "./components/schedule/TodayView";
import { TodosView } from "./components/todos/TodosView";
import { PomoView } from "./components/pomo/PomoView";
import { SettingsView } from "./components/SettingsView";
import { FloatingPomo } from "./components/pomo/FloatingPomo";
import { getTimerInstance, stopTimer } from "./components/pomo/timerState";
import { usePomoData } from "./components/pomo/usePomoData";

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>("combined");
  const [navigateToDate, setNavigateToDate] = useState<string | undefined>(undefined);
  const { signOut } = useAuthActions();
  const [pomoTick, setPomoTick] = useState(0);

  const todos = useQuery(api.todos.list, { includeCompleted: false });
  const todoBadge = todos?.length ?? 0;
  const { addSession } = usePomoData();

  const processMissed = useMutation(api.occurrences.processMissedEvents);
  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const key = `unitrack:processed:${todayStr}`;
    if (localStorage.getItem(key)) return;
    processMissed({ today: todayStr })
      .then(() => localStorage.setItem(key, "1"))
      .catch((err) => {
        console.warn("Failed to process missed events:", err);
      });
  }, [processMissed]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNavigateToDate = (date: string) => {
    setNavigateToDate(date);
    setActiveTab("today");
  };

  // Pomo timer interval — runs continuously at App level so it survives tab switches
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    tickRef.current = setInterval(() => {
      const timer = getTimerInstance();
      if (!timer || !timer.isRunning) return;

      if (timer.isComplete()) {
        if (timer.phase?.type === "work") {
          const d = new Date();
          addSession(
            d.toISOString().split("T")[0],
            d.toTimeString().split(" ")[0],
            timer.duration,
            timer.topic || timer.taskName || "Work",
          );
          timer.addWorkMinutes(timer.duration);
        }
        const hasMore = timer.advancePhase();
        if (!hasMore || timer.isCycleComplete()) {
          stopTimer();
        }
      }
      setPomoTick((t) => t + 1);
    }, 200);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [addSession]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "1" && !e.metaKey && !e.ctrlKey) {
        setActiveTab("combined");
      } else if (e.key === "2" && !e.metaKey && !e.ctrlKey) {
        setActiveTab("today");
      } else if (e.key === "3" && !e.metaKey && !e.ctrlKey) {
        setActiveTab("todos");
      } else if (e.key === "4" && !e.metaKey && !e.ctrlKey) {
        setActiveTab("pomo");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const timer = getTimerInstance();
  const showFloating =
    activeTab !== "pomo" && timer?.isRunning && timer.phase;

  return (
    <div className="h-screen flex flex-col bg-cream">
      <Nav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        todoBadge={todoBadge}
      />

      <div className="flex-1 min-h-0 overflow-y-auto sm:pl-14 pb-20 sm:pb-0 relative">
        {activeTab === "combined" && (
          <CombinedView
            onGoToTodos={() => setActiveTab("todos")}
            onGoToSchedule={() => setActiveTab("today")}
          />
        )}
        {activeTab === "today" && (
          <TodayView
            onGoToTodos={() => setActiveTab("todos")}
            initialDate={navigateToDate}
          />
        )}
        {activeTab === "todos" && (
          <TodosView onNavigateToDate={handleNavigateToDate} />
        )}
        {activeTab === "pomo" && (
          <PomoView
            pomoTick={pomoTick}
            activeTab={activeTab}
          />
        )}
        {activeTab === "settings" && (
          <SettingsView onSignOut={handleSignOut} />
        )}

        {showFloating && (
          <FloatingPomo
            timer={timer!}
            onNavigate={() => setActiveTab("pomo")}
          />
        )}
      </div>
    </div>
  );
}

export function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth />;
  }

  return <MainApp />;
}

export default App;
