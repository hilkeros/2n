"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NearbyAudioPlayer } from "@/components/NearbyAudioPlayer";

type Mode = "solo" | "group";
type PermissionState = "idle" | "granted" | "denied" | "error";
type NearbyUser = { did: string; distanceMeters: number; handle?: string | null };
type JoinState = "loading" | "joined" | "not_joined";

const RADIUS_METERS = 100;
const REFRESH_INTERVAL_MS = 5_000;

export function ProximitySummary({ currentUserLabel }: { currentUserLabel: string }) {
  const updatesEnabledRef = useRef(true);
  const phaseFrameRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef<number | null>(null);
  const visualLevelRef = useRef(0);
  const isAudioPlayingRef = useRef(false);
  const [joinState, setJoinState] = useState<JoinState>("loading");
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>("idle");
  const [nearbyCount, setNearbyCount] = useState(0);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [phase, setPhase] = useState(0);
  const expressiveLevel = useMemo(() => {
    if (!isAudioPlaying) return 0;
    const boosted = Math.min(1, audioLevel * 1.22);
    return Math.min(1, Math.pow(boosted, 0.72));
  }, [audioLevel, isAudioPlaying]);

  const mode: Mode = useMemo(() => (nearbyCount >= 1 ? "group" : "solo"), [nearbyCount]);
  const isGroupMode = mode === "group";
  const participantCount = joinState === "joined" ? nearbyCount + 1 : 1;
  const dustParticles = useMemo(
    () =>
      Array.from({ length: 320 }, (_, i) => {
        const seed = hashString(`dust-${i}`);
        const rand = createSeededRandom(seed);
        const angle = rand() * Math.PI * 2 - Math.PI;
        const areaSample = rand();
        const orbit = 12 + Math.sqrt(areaSample) * 116;
        return {
          key: `dust-${i}`,
          angle,
          orbit,
          sway: 2.5 + rand() * 12,
          speed: 0.15 + rand() * 0.25,
          size: 0.85 + rand() * 1.35,
          opacity: 0.11 + rand() * 0.3,
        };
      }),
    [],
  );
  const orbitingHandles = useMemo(
    () =>
      nearbyUsers.map((user, index, users) => {
        const label = user.handle ?? formatDid(user.did);
        const seed = hashString(user.did);
        const angleOffset = ((seed % 100) / 100) * 0.5 - 0.25;
        const radiusOffset = seed % 26;
        const blockedArc = 1.2;
        const availableArc = Math.PI * 2 - blockedArc;
        const startAngle = -Math.PI / 2 + blockedArc / 2;
        const baseAngle =
          startAngle + (availableArc * index) / Math.max(users.length, 1);
        const angle = baseAngle + angleOffset;
        const radius = 184 + radiusOffset;

        return {
          did: user.did,
          label,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        };
      }),
    [nearbyUsers],
  );
  const currentUserPlanet = useMemo(() => {
    const radius = 210;
    const angle = (3 * Math.PI) / 4;

    return {
      label: currentUserLabel,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  }, [currentUserLabel]);

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

  const handleLeave = useCallback(async () => {
    setLeaveSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/join", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete join record");
      }

      await fetch("/api/location", { method: "DELETE" }).catch(() => null);

      setNearbyCount(0);
      setNearbyUsers([]);
      setJoinState("not_joined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete join record");
    } finally {
      setLeaveSubmitting(false);
    }
  }, []);

  useEffect(() => {
    void loadJoinStatus();
  }, [loadJoinStatus]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("n2:join-state", {
        detail: { joined: joinState === "joined" },
      }),
    );
  }, [joinState]);

  useEffect(() => {
    visualLevelRef.current = expressiveLevel;
  }, [expressiveLevel]);

  useEffect(() => {
    isAudioPlayingRef.current = isAudioPlaying;
  }, [isAudioPlaying]);

  useEffect(() => {
    const animate = (timestamp: number) => {
      const previous = lastFrameTsRef.current ?? timestamp;
      const deltaMs = Math.min(48, timestamp - previous);
      lastFrameTsRef.current = timestamp;

      const level = visualLevelRef.current;
      const playing = isAudioPlayingRef.current;
      const radiansPerSecond = playing ? 0.5 + level * 2.1 : 0;

      setPhase((prev) => prev + (deltaMs / 1000) * radiansPerSecond);
      phaseFrameRef.current = requestAnimationFrame(animate);
    };

    phaseFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (phaseFrameRef.current !== null) {
        cancelAnimationFrame(phaseFrameRef.current);
        phaseFrameRef.current = null;
      }
      lastFrameTsRef.current = null;
    };
  }, []);

  useEffect(() => {
    updatesEnabledRef.current = true;
    if (joinState !== "joined") {
      setAudioLevel(0);
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
  const permissionDotClass =
    permissionState === "granted"
      ? "bg-emerald-400"
      : permissionState === "denied"
        ? "bg-rose-400"
        : "bg-zinc-500";

  if (joinState === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm tracking-[0.25em] text-zinc-500">LOADING</p>
      </div>
    );
  }

  if (joinState !== "joined") {
    return (
      <div className="space-y-3 py-16 text-center">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">music should be social</p>
          <p className="text-sm text-zinc-300">Join this song to enter the listening experience.</p>
          <button
            type="button"
            disabled={joinSubmitting}
            onClick={handleJoin}
            className="rounded-full border border-zinc-600 bg-zinc-900 px-6 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {joinSubmitting ? "Joining..." : "Join"}
          </button>
        </div>

        {error && <p className="text-center text-sm text-rose-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <NearbyAudioPlayer
          mode={mode}
          variant="overlay"
          onLevelChange={setAudioLevel}
          onPlaybackChange={setIsAudioPlaying}
        />
      </div>

      <div className="relative mx-auto h-[22rem] w-full max-w-[30rem] md:h-[25rem] md:max-w-[34rem]">
        <div
          className="absolute left-1/2 top-1/2 z-20"
          style={{ transform: `translate(-50%, -50%) translate(${currentUserPlanet.x}px, ${currentUserPlanet.y}px)` }}
        >
          <div className="max-w-[7.5rem] truncate whitespace-nowrap rounded-full border border-amber-300/70 bg-amber-200/14 px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-amber-100 shadow-[0_0_40px_rgba(251,191,36,0.22)] backdrop-blur-sm md:max-w-[9rem] md:text-xs">
            {currentUserPlanet.label}
          </div>
        </div>

        {orbitingHandles.map((planet) => (
          <div
            key={planet.did}
            className="absolute left-1/2 top-1/2 z-20"
            style={{ transform: `translate(-50%, -50%) translate(${planet.x}px, ${planet.y}px)` }}
          >
            <div className="max-w-[7rem] truncate whitespace-nowrap rounded-full border border-zinc-700 bg-zinc-900/85 px-2.5 py-1 text-[11px] tracking-[0.08em] text-zinc-300 shadow-[0_0_35px_rgba(59,130,246,0.08)] backdrop-blur-sm md:max-w-[8.5rem] md:text-xs">
              {planet.label}
            </div>
          </div>
        ))}

        <div className="absolute left-1/2 top-1/2 flex h-56 w-56 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/70 shadow-[0_0_100px_rgba(59,130,246,0.18)] backdrop-blur-sm transition md:h-64 md:w-64">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: isGroupMode
                ? `0 0 ${95 + expressiveLevel * 220}px rgba(251, 191, 36, ${0.28 + expressiveLevel * 0.52}) inset, 0 0 ${90 + expressiveLevel * 250}px rgba(245, 158, 11, ${0.34 + expressiveLevel * 0.52})`
                : `0 0 ${80 + expressiveLevel * 160}px rgba(56, 189, 248, ${0.16 + expressiveLevel * 0.36}) inset, 0 0 ${65 + expressiveLevel * 165}px rgba(59, 130, 246, ${0.18 + expressiveLevel * 0.3})`,
              transform: `scale(${1 + expressiveLevel * 0.12})`,
            }}
          />
          {dustParticles.map((p) => {
            const wobble =
              Math.sin(phase * p.speed + p.angle) *
              p.sway *
              (0.5 + expressiveLevel * 2.2);
            const radius = p.orbit + wobble;
            const x = Math.cos(p.angle + phase * p.speed * 0.5) * radius;
            const y = Math.sin(p.angle + phase * p.speed * 0.5) * radius;

            return (
              <span
                key={p.key}
                className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: `${p.size + expressiveLevel * 3.6}px`,
                  height: `${p.size + expressiveLevel * 3.6}px`,
                  opacity: p.opacity + expressiveLevel * 0.34,
                  filter: `blur(${0.35 + expressiveLevel * 1.35}px)`,
                  backgroundColor: isGroupMode ? "rgb(253, 230, 138)" : "rgb(244, 244, 245)",
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                }}
              />
            );
          })}
          <span
            className={`pointer-events-none relative z-10 text-[5.75rem] font-semibold leading-none md:text-[6.75rem] ${
              isGroupMode ? "text-amber-200" : "text-zinc-100"
            }`}
            style={{
              textShadow: isGroupMode
                ? `0 0 ${20 + expressiveLevel * 45}px rgba(251, 191, 36, ${0.5 + expressiveLevel * 0.3})`
                : "none",
            }}
          >
            {participantCount}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${permissionDotClass}`} />
        <span>Location {permissionLabel}</span>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={leaveSubmitting}
          onClick={handleLeave}
          className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {leaveSubmitting ? "Leaving..." : "Leave"}
        </button>
      </div>

      {error && <p className="text-center text-sm text-rose-400">{error}</p>}
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

function hashString(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function createSeededRandom(seed: number): () => number {
  let state = seed || 1;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;

    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}
