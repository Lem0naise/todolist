import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BrandLockup } from "./Brand";
import { APP_DESCRIPTION, APP_NAME } from "../lib/brand";

function initialsFrom(name: string | null, email: string | null) {
  const source = name?.trim() || email?.split("@")[0]?.trim() || "M";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "M";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase();
}

function displayNameFor(name: string | null, email: string | null) {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const local = email?.split("@")[0]?.trim();
  if (local) return local;
  return `${APP_NAME} user`;
}

function providerLabel(providers: string[] | undefined) {
  if (!providers || providers.length === 0) return "Email & password";
  return providers
    .map((provider) => (provider === "password" ? "Email & password" : provider))
    .join(", ");
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="bg-cream-50 rounded-xl border border-cream-200 px-3 py-3 text-center">
      <p className="text-2xl font-bold text-stone-700 font-hand leading-none">
        {value ?? "—"}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mt-1.5">
        {label}
      </p>
    </div>
  );
}

function AboutMyTerm() {
  return (
    <section className="bg-white rounded-2xl border border-cream-200 p-4">
      <BrandLockup size="sm" />
      <p className="text-xs text-stone-400 mt-2">{APP_DESCRIPTION}</p>
    </section>
  );
}

export function AccountPanel({ onSignOut }: { onSignOut: () => void }) {
  const viewer = useQuery(api.users.viewer);
  const todos = useQuery(api.todos.list, { includeCompleted: true });
  const events = useQuery(api.timetable.list);
  const sessions = useQuery(api.pomo.list);

  const name = viewer?.name ?? null;
  const email = viewer?.email ?? null;
  const displayName = displayNameFor(name, email);
  const memberSince = viewer
    ? new Date(viewer.createdAt).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-cream-200 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-500 flex items-center justify-center font-hand text-2xl font-bold flex-shrink-0">
            {viewer === undefined ? "…" : initialsFrom(name, email)}
          </div>
          <div className="min-w-0 flex-1">
            {viewer === undefined ? (
              <>
                <div className="h-4 w-28 bg-cream-200 rounded animate-pulse" />
                <div className="h-3 w-40 bg-cream-100 rounded mt-2 animate-pulse" />
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-stone-700 font-hand text-2xl truncate">
                  {displayName}
                </h3>
                <p className="text-xs text-stone-400 truncate">
                  {email ?? "No email on file"}
                </p>
              </>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-mint-600 bg-mint-50 border border-mint-100 px-2 py-1 rounded-full flex-shrink-0">
            Cloud
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-cream-100 pt-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Member since
            </p>
            <p className="text-xs text-stone-600 mt-0.5">{memberSince ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Sign-in method
            </p>
            <p className="text-xs text-stone-600 mt-0.5">
              {viewer === undefined || viewer === null
                ? "—"
                : providerLabel(viewer.providers)}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-cream-50 rounded-2xl border border-cream-200 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Tasks" value={todos?.length} />
          <Stat label="Events" value={events?.length} />
          <Stat label="Focus" value={sessions?.length} />
        </div>
        <div className="flex items-start gap-2 mt-4">
          <span className="w-2 h-2 rounded-full bg-mint-400 mt-1 flex-shrink-0" />
          <p className="text-xs text-stone-500">
            Cloud sync is on. Your tasks, timetable and focus sessions are saved
            to your {APP_NAME} account.
          </p>
        </div>
      </section>

      <section>
        <button
          onClick={onSignOut}
          className="w-full py-2 text-sm font-medium text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </section>

      <AboutMyTerm />
    </div>
  );
}

export function GuestAccountPanel({
  onNavigateToAuth,
}: {
  onNavigateToAuth: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-cream-200 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-lavender-100 text-lavender-600 flex items-center justify-center font-hand text-2xl font-bold flex-shrink-0">
            G
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-stone-700 font-hand text-2xl">
              Guest
            </h3>
            <p className="text-xs text-stone-400">Not signed in</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-50 border border-rose-100 px-2 py-1 rounded-full flex-shrink-0">
            Local only
          </span>
        </div>

        <p className="text-xs text-stone-500 mt-4 border-t border-cream-100 pt-3">
          Your tasks and focus sessions are stored in this browser only. Sign in
          to sync them across devices and import your timetable.
        </p>

        <button
          onClick={onNavigateToAuth}
          className="mt-4 w-full py-2 text-sm font-bold text-white bg-rose-400 hover:bg-rose-500 rounded-lg transition-colors shadow-sm"
        >
          Sign in or create account
        </button>
      </section>

      <AboutMyTerm />
    </div>
  );
}
