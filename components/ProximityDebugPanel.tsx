"use client";

import { useCallback, useEffect, useState } from "react";

interface DebugPayload {
  did: string;
  now: number;
  activeWindowMs: number;
  activeCutoff: number;
  nearbyCount: number;
  myLocation: {
    did: string;
    latitude: number;
    longitude: number;
    accuracy_meters: number;
    updated_at: number;
  } | null;
  activeRows: Array<{
    did: string;
    latitude: number;
    longitude: number;
    accuracy_meters: number;
    updated_at: number;
  }>;
  pairwiseDistances: Array<{
    fromDid: string;
    toDid: string;
    meters: number;
  }>;
}

const POLL_MS = 3_000;

export function ProximityDebugPanel() {
  const [payload, setPayload] = useState<DebugPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/debug/proximity", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Debug endpoint failed (${response.status})`);
      }

      const data = (await response.json()) as DebugPayload;
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load debug data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Proximity Debug</h2>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Refresh now
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-600 dark:text-zinc-400">Refreshing...</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {payload && (
        <>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Current DID: {payload.did}</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Nearby users in 100m: {payload.nearbyCount}
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Active window: {payload.activeWindowMs / 1000}s
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Active rows: {payload.activeRows.length}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">Active users</h3>
            <pre className="max-h-64 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
              {JSON.stringify(payload.activeRows, null, 2)}
            </pre>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">Pairwise distances (meters)</h3>
            {payload.pairwiseDistances.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Need at least two active users.</p>
            ) : (
              <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                {payload.pairwiseDistances.map((item) => (
                  <li key={`${item.fromDid}-${item.toDid}`}>
                    {item.fromDid} ↔ {item.toDid}: {item.meters}m
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
