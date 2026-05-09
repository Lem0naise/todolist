import type { ReactNode } from "react";
import { useDarkMode } from "../hooks/useDarkMode";

export type Tab = "combined" | "today" | "todos" | "settings";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  todoBadge?: number;
}

export function Nav({ activeTab, onTabChange, todoBadge }: Props) {
  const { dark, toggle: toggleDark } = useDarkMode();

  const tabs: { id: Tab; label: string; icon: ReactNode; shortcut: string }[] = [
    {
      id: "combined",
      label: "Home",
      shortcut: "1",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: "today",
      label: "Schedule",
      shortcut: "2",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: "todos",
      label: "Tasks",
      shortcut: "3",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      shortcut: "",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <nav className="group hidden sm:flex flex-col border-r border-cream-200 bg-cream pt-4 gap-1 fixed left-0 top-0 bottom-0 z-30 w-14 hover:w-52 transition-all duration-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 mb-4 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-rose-400 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white text-base font-hand font-bold">u</span>
          </div>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-base font-bold text-stone-700 truncate whitespace-nowrap font-hand text-2xl">
            uni
          </span>
        </div>

        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={`${tab.label}${tab.shortcut ? ` (${tab.shortcut})` : ""}`}
            className={`relative mx-2 rounded-xl flex items-center gap-3 px-2 py-2.5 transition-all flex-shrink-0 ${
              activeTab === tab.id
                ? "bg-rose-50 text-rose-500"
                : "text-stone-400 hover:text-stone-600 hover:bg-cream-100"
            }`}
          >
            <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">
              {tab.icon}
            </span>
            <span
              className={`opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-sm font-medium whitespace-nowrap ${
                activeTab === tab.id ? "text-rose-500" : ""
              }`}
            >
              {tab.label}
            </span>
            {tab.id === "todos" &&
              todoBadge !== undefined &&
              todoBadge > 0 && (
                <span className="absolute top-1 right-1 group-hover:static group-hover:ml-auto w-5 h-5 bg-rose-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {todoBadge > 9 ? "9+" : todoBadge}
                </span>
              )}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={toggleDark}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="mx-2 mb-4 rounded-xl flex items-center gap-3 px-2 py-2.5 text-stone-400 hover:text-stone-600 hover:bg-cream-100 transition-all flex-shrink-0"
        >
          <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">
            {dark ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-sm font-medium whitespace-nowrap">
            {dark ? "Light mode" : "Dark mode"}
          </span>
        </button>
      </nav>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-cream border-t border-cream-200">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative ${
                activeTab === tab.id
                  ? "text-rose-500"
                  : "text-stone-400"
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.id === "todos" &&
                  todoBadge !== undefined &&
                  todoBadge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {todoBadge > 9 ? "9+" : todoBadge}
                    </span>
                  )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
