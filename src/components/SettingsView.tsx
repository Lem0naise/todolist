import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Feed = {
  _id: Id<"icalFeeds">;
  url: string;
  name: string;
  lastSynced?: number;
};

export function SettingsView({ onSignOut }: { onSignOut: () => void }) {
  const [activeTab, setActiveTab] = useState<"timetable" | "account">("timetable");

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
      </div>

      <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
        <button
          onClick={() => setActiveTab("timetable")}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === "timetable" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Timetable
        </button>
        <button
          onClick={() => setActiveTab("account")}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === "account" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Account
        </button>
      </div>

      {activeTab === "timetable" ? (
        <TimetableSettings />
      ) : (
        <AccountSettings onSignOut={onSignOut} />
      )}
    </div>
  );
}

function TimetableSettings() {
  const [showIcsForm, setShowIcsForm] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const feeds = useQuery(api.timetable.listFeeds);
  const events = useQuery(api.timetable.list);
  const removeFeed = useMutation(api.timetable.removeFeed);
  const removeByFeed = useMutation(api.timetable.removeByFeed);
  const removeEvent = useMutation(api.timetable.remove);

  const handleDeleteFeed = async (feed: Feed) => {
    if (!confirm(`Delete "${feed.name}" and all its events?`)) return;
    await removeByFeed({ feedId: feed._id });
    await removeFeed({ id: feed._id });
  };

  const manualEvents = events?.filter((e) => e.source === "manual") ?? [];

  return (
    <div className="space-y-6">
      {/* ICS Import */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Calendar feeds (iCAL)</h3>
          <button
            onClick={() => setShowIcsForm(!showIcsForm)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add feed
          </button>
        </div>

        {showIcsForm && (
          <IcsImportForm onDone={() => setShowIcsForm(false)} />
        )}

        {feeds == null ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : feeds.length === 0 ? (
          <p className="text-sm text-slate-400">
            No feeds yet. Add your university timetable iCAL link.
          </p>
        ) : (
          <div className="space-y-2">
            {feeds.map((feed) => (
              <div
                key={feed._id}
                className="flex items-start justify-between gap-2 bg-slate-50 rounded-lg p-3 border border-slate-200"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{feed.name}</p>
                  <p className="text-xs text-slate-400 truncate">{feed.url}</p>
                  {feed.lastSynced && (
                    <p className="text-xs text-slate-400">
                      Synced {new Date(feed.lastSynced).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteFeed(feed)}
                  className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Manual Events */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Manual events</h3>
          <button
            onClick={() => setShowManualForm(!showManualForm)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add event
          </button>
        </div>

        {showManualForm && (
          <ManualEventForm onDone={() => setShowManualForm(false)} />
        )}

        {manualEvents.length === 0 ? (
          <p className="text-sm text-slate-400">No manually added events.</p>
        ) : (
          <div className="space-y-2">
            {manualEvents.map((event) => (
              <div
                key={event._id}
                className="flex items-start justify-between gap-2 bg-slate-50 rounded-lg p-3 border border-slate-200"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{event.title}</p>
                  <p className="text-xs text-slate-400">
                    {event.isRecurring
                      ? `Every ${DAYS[event.dayOfWeek ?? 0]} at ${event.startTime}`
                      : `${event.specificDate} at ${event.startTime}`}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => removeEvent({ id: event._id })}
                  className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tips */}
      <section className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h4 className="text-xs font-semibold text-blue-800 mb-2">How to get your iCAL link</h4>
        <ul className="space-y-1 text-xs text-blue-700">
          <li><strong>Outlook/Office 365:</strong> Calendar → Share → Get a link → View only</li>
          <li><strong>Google Calendar:</strong> Settings → your calendar → Integrate → Secret address in iCal format</li>
          <li><strong>Timetable systems:</strong> Look for "Export" or "Subscribe" in your uni's timetable portal</li>
        </ul>
      </section>
    </div>
  );
}

function IcsImportForm({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const importIcs = useAction(api.icsImport.importIcsUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setSuccessCount(null);
    try {
      const result = await importIcs({
        url: url.trim(),
        name: name.trim() || "My Timetable",
      });
      setSuccessCount(result.count);
      // Auto-close after a short delay
      setTimeout(onDone, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-4 mb-3 space-y-3">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Feed name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Uni Timetable"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">iCAL URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          required
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {successCount !== null && (
        <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
          Imported {successCount} events successfully!
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg"
        >
          {loading ? "Importing..." : "Import"}
        </button>
      </div>
    </form>
  );
}

function ManualEventForm({ onDone }: { onDone: () => void }) {
  const createEvent = useMutation(api.timetable.create);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isRecurring, setIsRecurring] = useState(true);
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [recurrenceStart, setRecurrenceStart] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [specificDate, setSpecificDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createEvent({
        title: title.trim(),
        location: location.trim() || undefined,
        startTime,
        endTime: endTime || undefined,
        isRecurring,
        dayOfWeek: isRecurring ? dayOfWeek : undefined,
        recurrenceStart: isRecurring ? recurrenceStart : undefined,
        recurrenceEnd: isRecurring && recurrenceEnd ? recurrenceEnd : undefined,
        specificDate: !isRecurring ? specificDate : undefined,
        source: "manual",
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-4 mb-3 space-y-3">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Event title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Maths Lecture"
          required
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">Location (optional)</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Room 101"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">Start</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">End</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Recurring toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsRecurring(true)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            isRecurring ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-slate-200 text-slate-400"
          }`}
        >
          Weekly recurring
        </button>
        <button
          type="button"
          onClick={() => setIsRecurring(false)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            !isRecurring ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-slate-200 text-slate-400"
          }`}
        >
          One-off
        </button>
      </div>

      {isRecurring ? (
        <>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Day of week</label>
            <div className="flex gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDayOfWeek(i)}
                  className={`flex-1 py-1 text-xs rounded-lg border transition-colors ${
                    dayOfWeek === i
                      ? "bg-blue-50 border-blue-200 text-blue-600 font-medium"
                      : "bg-white border-slate-200 text-slate-400"
                  }`}
                >
                  {d.slice(0, 2)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input
                type="date"
                value={recurrenceStart}
                onChange={(e) => setRecurrenceStart(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Until (opt.)</label>
              <input
                type="date"
                value={recurrenceEnd}
                onChange={(e) => setRecurrenceEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </>
      ) : (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Date</label>
          <input
            type="date"
            value={specificDate}
            onChange={(e) => setSpecificDate(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg"
        >
          {loading ? "Saving..." : "Add event"}
        </button>
      </div>
    </form>
  );
}

function AccountSettings({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-600 mb-4">
          Manage your UniTrack account.
        </p>
        <button
          onClick={onSignOut}
          className="w-full py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
