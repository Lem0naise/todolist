import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

type Mode = "signin" | "signup";

export function Auth() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await signIn("password", { email, password, name, flow: "signUp" });
      } else {
        await signIn("password", { email, password, flow: "signIn" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-rose-400 flex items-center justify-center mx-auto shadow-sm mb-4">
            <span className="text-white text-2xl font-hand font-bold">u</span>
          </div>
          <h1 className="text-xl font-bold text-stone-700 font-hand text-3xl">uni</h1>
          <p className="text-stone-400 mt-1 text-sm">your uni tracker</p>
        </div>

        <div className="bg-white rounded-2xl border border-cream-200 p-5 shadow-sm">
          <div className="flex rounded-lg bg-cream-100 p-1 mb-5">
            <button
              onClick={() => { setMode("signin"); setError(null); }}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${
                mode === "signin"
                  ? "bg-white text-stone-700 shadow-sm"
                  : "text-stone-400 hover:text-stone-600"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); }}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${
                mode === "signup"
                  ? "bg-white text-stone-700 shadow-sm"
                  : "text-stone-400 hover:text-stone-600"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={mode === "signup"}
                  placeholder="your name"
                  className="w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 placeholder-stone-300 text-stone-700"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@university.ac.uk"
                className="w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 placeholder-stone-300 text-stone-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 placeholder-stone-300 text-stone-700"
              />
            </div>

            {error && (
              <p className="text-sm text-rose-500 bg-rose-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-rose-400 hover:bg-rose-500 disabled:bg-stone-200 text-white text-sm font-bold rounded-lg transition-colors"
            >
              {loading
                ? "please wait..."
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
