"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NearbyAudioPlayer } from "@/components/NearbyAudioPlayer";

type Mode = "solo" | "group";
type PermissionState = "idle" | "granted" | "denied" | "error";

const RADIUS_METERS = 100;
const REFRESH_INTERVAL_MS = 5_000;

export function ProximityExperience() {
  const [permissionState, setPermissionState] = useState<PermissionState>("idle");
  const [nearbyCount, setNearbyCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLocationStatus, setLastLocationStatus] = useState<number | null>(null);
  const [lastNearbyStatus, setLastNearbyStatus] = useState<number | null>(null);
  const [debugSnapshot, setDebugSnapshot] = useState<string | null>(null);

  const mode: Mode = useMemo(() => (nearbyCount >= 1 ? "group" : "solo"), [nearbyCount]);

  const tick = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const position = await getCurrentPosition();
      setPermissionState("granted");

      const locationResponse = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      });

      if (!locationResponse.ok) {
        throw new Error("Failed to publish location");
      }
      setLastLocationStatus(locationResponse.status);

      const nearbyResponse = await fetch(
        `/api/nearby?radiusMeters=${RADIUS_METERS}`,
        { cache: "no-store" },
      );
      setLastNearbyStatus(nearbyResponse.status);

      if (!nearbyResponse.ok) {
        throw new Error("Failed to fetch nearby users");
      }

      const nearbyPayload = (await nearbyResponse.json()) as { nearbyCount?: number };
      setNearbyCount(nearbyPayload.nearbyCount ?? 0);
    } catch (err) {
      if (isGeolocationError(err)) {
        setPermissionState(err.code === 1 ? "denied" : "error");
        setError("Location permission is required for proximity audio.");
      } else {
        setPermissionState((prev) => (prev === "idle" ? "error" : prev));
        setError(err instanceof Error ? err.message : "Failed to update proximity");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void tick();

    const interval = window.setInterval(() => {
      void tick();
    }, REFRESH_INTERVAL_MS);

    const handleVisibility = () => {
      if (!document.hidden) {
        void tick();
      }
    };

    const clearPresence = () => {
      navigator.sendBeacon("/api/location/clear");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", clearPresence);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", clearPresence);
    };
  }, [tick]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Proximity status</p>
        <div className="mt-2 grid gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          <p>Radius: {RADIUS_METERS}m</p>
          <p>Refresh: {REFRESH_INTERVAL_MS / 1000}s</p>
          <p>Nearby users: {nearbyCount}</p>
          <p>Mode: {mode}</p>
          <p>Location permission: {permissionState}</p>
          <p>Location API status: {lastLocationStatus ?? "n/a"}</p>
          <p>Nearby API status: {lastNearbyStatus ?? "n/a"}</p>
          {loading && <p>Updating location...</p>}
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              void fetchDebugSnapshot(setDebugSnapshot);
            }}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Refresh debug snapshot
          </button>
          {debugSnapshot && (
            <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
              {debugSnapshot}
            </pre>
          )}
        </div>
      </div>

      <NearbyAudioPlayer mode={mode} />
    </div>
  );
}

async function getCurrentPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    throw new Error("Geolocation is not supported by this browser");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 0,
    });
  });
}

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  if (!error || typeof error !== "object") return false;
  return "code" in error;
}

async function fetchDebugSnapshot(
  setDebugSnapshot: (value: string | null) => void,
): Promise<void> {
  const response = await fetch("/api/debug/proximity", { cache: "no-store" });
  const payload = await response.json();
  setDebugSnapshot(JSON.stringify(payload, null, 2));
}
