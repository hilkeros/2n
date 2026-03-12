"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NearbyAudioPlayer } from "@/components/NearbyAudioPlayer";

type Mode = "solo" | "group";
type PermissionState = "idle" | "granted" | "denied" | "error";
type NearbyUser = { did: string; distanceMeters: number; handle?: string | null };
type JoinState = "loading" | "joined" | "not_joined";

const RADIUS_METERS = 100;
const REFRESH_INTERVAL_MS = 5_000;

export function ProximitySummary() {
  const updatesEnabledRef = useRef(true);
  const [joinState, setJoinState] = useState<JoinState>("loading");
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>("idle");
  const [nearbyCount, setNearbyCount] = useState(0);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mode: Mode = useMemo(() => (nearbyCount >= 1 ? "group" : "solo"), [nearbyCount]);

  const loadJoinStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/join", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch join status");
      }

      const payload = (await response.json()) as { joined?: boolean };
      setJoinState(payload.joined ? "joined" : "not_joined");
    } catch (err) {
      setJoinState("not_joined");
      setError(err instanceof Error ? err.message : "Failed to fetch join status");
    }
  }, []);

  const tick = useCallback(async () => {
    if (!updatesEnabledRef.current) return;
    if (joinState !== "joined") return;

    try {
      const position = await getCurrentPosition();
      if (!updatesEnabledRef.current) return;
      setPermissionState("granted");
      setError(null);

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
        if (locationResponse.status === 403) {
          setJoinState("not_joined");
          throw new Error("Join this song first to participate.");
        }
        throw new Error("Failed to publish location");
      }

      const nearbyResponse = await fetch(
        `/api/nearby?radiusMeters=${RADIUS_METERS}`,
        { cache: "no-store" },
      );

      if (!nearbyResponse.ok) {
        throw new Error("Failed to fetch nearby users");
      }

      const nearbyPayload = (await nearbyResponse.json()) as {
        nearbyCount?: number;
        nearbyUsers?: NearbyUser[];
      };

      if (!updatesEnabledRef.current) return;
      setNearbyCount(nearbyPayload.nearbyCount ?? 0);
      setNearbyUsers(nearbyPayload.nearbyUsers ?? []);
    } catch (err) {
      if (isGeolocationError(err)) {
        setPermissionState(err.code === 1 ? "denied" : "error");
        setError("Location permission is required.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to update proximity");
      }
    }
  }, [joinState]);

  const handleJoin = useCallback(async () => {
    setJoinSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/join", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to create join record");
      }

      setJoinState("joined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create join record");
    } finally {
      setJoinSubmitting(false);
    }
  }, []);

  useEffect(() => {
    void loadJoinStatus();
  }, [loadJoinStatus]);

  useEffect(() => {
    updatesEnabledRef.current = true;
    if (joinState !== "joined") {
      return () => {
        updatesEnabledRef.current = false;
      };
    }

    void tick();

    const interval = window.setInterval(() => {
      void tick();
    }, REFRESH_INTERVAL_MS);

    const handleVisibility = () => {
      if (!document.hidden) {
        void tick();
      }
    };

    const handleLogoutStart = () => {
      updatesEnabledRef.current = false;
      window.clearInterval(interval);
      void fetch("/api/location", { method: "DELETE" }).catch(() => null);
    };

    const clearPresence = () => {
      navigator.sendBeacon("/api/location/clear");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", clearPresence);
    window.addEventListener("n2:logout-start", handleLogoutStart);

    return () => {
      updatesEnabledRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", clearPresence);
      window.removeEventListener("n2:logout-start", handleLogoutStart);
    };
  }, [joinState, tick]);

  const permissionLabel = permissionState === "granted" ? "Granted" : "Not granted";
  const listeningLabel = mode === "group" ? "Social listening" : "Solo listening";

  if (joinState !== "joined") {
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-5 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Access</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Join this song to unlock the proximity listening experience.
          </p>
          <button
            type="button"
            disabled={joinState === "loading" || joinSubmitting}
            onClick={handleJoin}
            className="mt-3 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {joinState === "loading" ? "Checking join status..." : joinSubmitting ? "Joining..." : "Join"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-5 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        Joined for this song. Proximity listening is active.
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <StatusTile label="Location" value={permissionLabel} />
        <StatusTile label="Nearby users" value={String(nearbyCount)} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Mode</p>
        <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{listeningLabel}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Nearby accounts</p>
        {nearbyUsers.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">No nearby accounts in range.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            {nearbyUsers.map((user) => (
              <li key={user.did}>
                {user.handle ?? formatDid(user.did)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <NearbyAudioPlayer mode={mode} />
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
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

function formatDid(did: string): string {
  if (did.length <= 28) return did;
  return `${did.slice(0, 16)}...${did.slice(-8)}`;
}
