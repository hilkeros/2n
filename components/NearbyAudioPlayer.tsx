"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface NearbyAudioPlayerProps {
  mode: "solo" | "group";
}

const TRACKS = {
  solo: "/audio/2to1-solo.mp3",
  group: "/audio/2to1-group.mp3",
};

const ACTIVE_VOLUME = 0.75;
const FADE_STEPS = 30;
const FADE_DURATION_MS = 1000;

export function NearbyAudioPlayer({ mode }: NearbyAudioPlayerProps) {
  const soloRef = useRef<HTMLAudioElement | null>(null);
  const groupRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Mount: create both audio elements, both silent
  useEffect(() => {
    const solo = new Audio(TRACKS.solo);
    solo.loop = true;
    solo.preload = "auto";
    solo.volume = 0;

    const group = new Audio(TRACKS.group);
    group.loop = true;
    group.preload = "auto";
    group.volume = 0;

    soloRef.current = solo;
    groupRef.current = group;

    return () => {
      solo.pause();
      group.pause();
      if (fadeTimerRef.current !== null) clearInterval(fadeTimerRef.current);
      soloRef.current = null;
      groupRef.current = null;
    };
  }, []);

  const crossfade = useCallback((incoming: "solo" | "group") => {
    if (fadeTimerRef.current !== null) clearInterval(fadeTimerRef.current);

    const inEl = incoming === "solo" ? soloRef.current : groupRef.current;
    const outEl = incoming === "solo" ? groupRef.current : soloRef.current;
    if (!inEl || !outEl) return;

    const startIn = inEl.volume;
    const startOut = outEl.volume;
    const stepIn = (ACTIVE_VOLUME - startIn) / FADE_STEPS;
    const stepOut = (startOut - 0) / FADE_STEPS;
    let step = 0;

    fadeTimerRef.current = setInterval(() => {
      step++;
      inEl.volume = Math.min(ACTIVE_VOLUME, Math.max(0, startIn + stepIn * step));
      outEl.volume = Math.max(0, startOut - stepOut * step);

      if (step >= FADE_STEPS) {
        inEl.volume = ACTIVE_VOLUME;
        outEl.volume = 0;
        clearInterval(fadeTimerRef.current!);
        fadeTimerRef.current = null;
      }
    }, FADE_DURATION_MS / FADE_STEPS);
  }, []);

  // React to mode changes while playing
  useEffect(() => {
    if (!isPlaying) return;
    crossfade(mode);
  }, [mode, isPlaying, crossfade]);

  async function toggleAudio() {
    setAudioError(null);

    if (isPlaying) {
      if (fadeTimerRef.current !== null) {
        clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      soloRef.current?.pause();
      groupRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    const solo = soloRef.current;
    const group = groupRef.current;
    if (!solo || !group) return;

    // Reset both to start, set initial volumes by mode
    solo.currentTime = 0;
    group.currentTime = 0;
    solo.volume = mode === "solo" ? ACTIVE_VOLUME : 0;
    group.volume = mode === "group" ? ACTIVE_VOLUME : 0;

    try {
      await Promise.all([solo.play(), group.play()]);
      setIsPlaying(true);
    } catch {
      setAudioError(
        "Unable to start audio. Make sure /public/audio/2to1-solo.mp3 and /public/audio/2to1-group.mp3 exist, then try again.",
      );
    }
  }

  const modeLabel = mode === "group" ? "Social listening" : "Solo listening";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Audio</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{modeLabel}</p>
        </div>
        <button
          type="button"
          onClick={toggleAudio}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPlaying ? "Stop" : "Play"}
        </button>
      </div>

      {audioError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{audioError}</p>}
    </div>
  );
}
