import { useState, useEffect } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { Auth } from "./components/Auth";
import { Nav } from "./components/Nav";
import type { Tab } from "./components/Nav";
import { CombinedView } from "./components/CombinedView";
import { TodayView } from "./components/TodayView";
import { TodosView } from "./components/TodosView";
import { SettingsView } from "./components/SettingsView";

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>("combined");
  const [navigateToDate, setNavigateToDate] = useState<string | undefined>(undefined);
  const { signOut } = useAuthActions();

  // Get todo count for badge
  const todos = useQuery(api.todos.list, { includeCompleted: false });
  const todoBadge = todos?.length ?? 0;

  // Process missed lecture events once per day, regardless of active tab
  const processMissed = useMutation(api.occurrences.processMissedEvents);
  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const key = `unitrack:processed:${todayStr}`;
    if (localStorage.getItem(key)) return;
    processMissed({ today: todayStr })
      .then(() => localStorage.setItem(key, "1"))
      .catch(() => {});
  }, [processMissed]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNavigateToDate = (date: string) => {
    setNavigateToDate(date);
    setActiveTab("today");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        todoBadge={todoBadge}
      />

      {/* Content area —
          sm+: offset by icon-only sidebar (w-14)
          lg+: offset by wide sidebar (w-52)
          mobile: extra bottom padding for bottom nav */}
      <div className="sm:pl-14 pb-20 sm:pb-0">
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
        {activeTab === "settings" && (
          <SettingsView onSignOut={handleSignOut} />
        )}
      </div>
    </div>
  );
}

export function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth />;
  }

  return <MainApp />;
}

export default App;
