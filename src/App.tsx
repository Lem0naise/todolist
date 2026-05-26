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
import { SplashScreen } from "./components/pomo/SplashScreen";
import { getTimerInstance, stopTimer, persist, restoreTimer } from "./components/pomo/timerState";
import { usePomoData, getLocalDate } from "./components/pomo/usePomoData";
import { useGuestPomoSessions } from "./hooks/useGuestPomoSessions";
import { GuestContext } from "./hooks/useGuestMode";

function MainApp({ isGuest, onNavigateToAuth }: { isGuest: boolean; onNavigateToAuth: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>("combined");
  const [navigateToDate, setNavigateToDate] = useState<string | undefined>(undefined);
  const { signOut } = useAuthActions();
  const [pomoTick, setPomoTick] = useState(0);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);

  const todos = useQuery(api.todos.list, { includeCompleted: false });
  const todoBadge = todos?.length ?? 0;

  // Pomo data — Convex when authenticated, localStorage when guest
  const authenticatedPomo = usePomoData();
  const guestPomo = useGuestPomoSessions(isGuest);
  const { addSession } = isGuest ? guestPomo : authenticatedPomo;

  // Restore persisted timer on mount
  useEffect(() => {
    restoreTimer();
  }, []);

  const processMissed = useMutation(api.occurrences.processMissedEvents);
  useEffect(() => {
    if (isGuest) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const key = `unitrack:processed:${todayStr}`;
    if (localStorage.getItem(key)) return;
    processMissed({ today: todayStr })
      .then(() => localStorage.setItem(key, "1"))
      .catch((err) => {
        console.warn("Failed to process missed events:", err);
      });
  }, [processMissed, isGuest]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNavigateToDate = (date: string) => {
    setNavigateToDate(date);
    setActiveTab("today");
  };

  // Pomo timer interval
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    tickRef.current = setInterval(() => {
      const timer = getTimerInstance();
      if (!timer || !timer.isRunning) return;

      persist();

      if (timer.isComplete()) {
        if (timer.phase?.type === "work") {
          const d = new Date();
          addSession(
            getLocalDate(),
            d.toTimeString().split(" ")[0],
            timer.duration,
            timer.topic || timer.taskName || "Work",
          );
          timer.addWorkMinutes(timer.duration);
        }
        timer.enterSplash();
      }

      // Handle splash timer expiry
      if (timer.isInSplash() && timer.splashUntil && Date.now() >= timer.splashUntil.getTime()) {
        if (!timer.exitSplash()) {
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
  const showFloating = activeTab !== "pomo" && timer?.isRunning;

  return (
    <GuestContext.Provider value={{ isGuest }}>
      <div className="h-screen flex flex-col bg-cream">
        <Nav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          todoBadge={todoBadge}
        />

        {isGuest && !guestBannerDismissed && (
          <div className="sm:pl-14 flex items-center justify-between px-4 py-2 bg-rose-50 border-b border-rose-100 text-xs font-bold text-rose-500 flex-shrink-0">
            <span>
              Guest mode — data stored in this browser only.
              <span className="hidden sm:inline"> Sign in to sync and import your timetable.</span>
            </span>
            <div className="flex items-center gap-2">
              <button onClick={onNavigateToAuth} className="px-2 py-1 bg-rose-400 text-white rounded-lg text-[10px] hover:bg-rose-500">
                Sign in
              </button>
              <button onClick={() => setGuestBannerDismissed(true)} className="text-rose-300 hover:text-rose-400 text-lg leading-none">
                ×
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto sm:pl-14 pb-20 sm:pb-0 relative">
          {activeTab === "combined" && (
            <CombinedView
              onGoToTodos={() => setActiveTab("todos")}
              onGoToSchedule={() => setActiveTab("today")}
            />
          )}
        {activeTab === "today" && (
          <TodayView
            key={navigateToDate ?? "today"}
            onGoToTodos={() => setActiveTab("todos")}
            initialDate={navigateToDate}
          />
        )}
          {activeTab === "todos" && (
            <TodosView onNavigateToDate={handleNavigateToDate} />
          )}
          {activeTab === "pomo" && (
            <PomoView pomoTick={pomoTick} />
          )}
          {activeTab === "settings" && (
            <SettingsView onSignOut={handleSignOut} onNavigateToAuth={onNavigateToAuth} />
          )}

          {showFloating && (
            <FloatingPomo
              timer={timer!}
              onNavigate={() => setActiveTab("pomo")}
            />
          )}
        </div>

        {timer?.isInSplash() && (
          <SplashScreen onSkip={() => {
            if (!timer.exitSplash()) {
              stopTimer();
            }
          }} />
        )}
      </div>
    </GuestContext.Provider>
  );
}

export function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [isGuest, setIsGuest] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated && !isGuest) {
    return <Auth onContinueAsGuest={() => setIsGuest(true)} />;
  }

  return <MainApp isGuest={isGuest} onNavigateToAuth={() => setIsGuest(false)} />;
}

export default App;
