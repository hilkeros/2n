"use client";

import { useState } from "react";

export function LoginForm() {
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/oauth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Redirect to authorization server
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
          Sign in with your handle
        </h2>
        <p className="text-sm text-zinc-400">
          Use your AT Protocol handle, for example <span className="font-mono">alice.bsky.social</span>.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium uppercase tracking-[0.12em] text-zinc-400">
          Handle
        </label>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="user.example.com"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950/75 px-3 py-2.5 text-zinc-100 shadow-sm outline-none transition placeholder:text-zinc-500 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-200/20"
          disabled={loading}
          autoComplete="username"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-rose-900/70 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !handle}
        className="w-full rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2.5 font-medium text-zinc-100 shadow-[0_0_30px_rgba(0,0,0,0.25)] transition hover:border-amber-300/70 hover:bg-zinc-800 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
