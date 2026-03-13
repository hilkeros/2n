"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface NearbyAudioPlayerProps {
  mode: "solo" | "group";
  variant?: "panel" | "overlay";
  onLevelChange?: (level: number) => void;
  onPlaybackChange?: (isPlaying: boolean) => void;
}

const TRACKS = {
  solo: "/audio/2to1-solo.mp3",
  group: "/audio/2to1-group.mp3",
};

const ACTIVE_VOLUME = 0.75;
const FADE_STEPS = 30;
const FADE_DURATION_MS = 1000;

export function NearbyAudioPlayer({
  mode,
  variant = "panel",
  onLevelChange,
  onPlaybackChange,
}: NearbyAudioPlayerProps) {
  const soloRef = useRef<HTMLAudioElement | null>(null);
  const groupRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const soloSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const groupSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const smoothedLevelRef = useRef(0);
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
      if (meterFrameRef.current !== null) cancelAnimationFrame(meterFrameRef.current);
      onLevelChange?.(0);
      onPlaybackChange?.(false);
      soloRef.current = null;
      groupRef.current = null;
    };
  }, [onLevelChange, onPlaybackChange]);

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

  function stopMetering() {
    if (meterFrameRef.current !== null) {
      cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    smoothedLevelRef.current = 0;
    onLevelChange?.(0);
  }

  function startMetering() {
    const solo = soloRef.current;
    const group = groupRef.current;
    if (!solo || !group) return;

    if (!audioCtxRef.current) {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;

      const soloSource = ctx.createMediaElementSource(solo);
      const groupSource = ctx.createMediaElementSource(group);

      soloSource.connect(analyser);
      groupSource.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      meterDataRef.current = new Uint8Array(
        new ArrayBuffer(analyser.frequencyBinCount),
      ) as Uint8Array<ArrayBuffer>;
      soloSourceRef.current = soloSource;
      groupSourceRef.current = groupSource;
    }

    const ctx = audioCtxRef.current;
    const analyser = analyserRef.current;
    const meterData = meterDataRef.current;
    if (!ctx || !analyser || !meterData) return;

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const tick = () => {
      analyser.getByteTimeDomainData(meterData);

      let sum = 0;
      for (let i = 0; i < meterData.length; i++) {
        const v = (meterData[i] - 128) / 128;
        sum += v * v;
      }

      const rms = Math.sqrt(sum / meterData.length);

      // Push subtle signals up while still keeping headroom for louder moments.
      const gated = Math.max(0, rms - 0.012);
      const boosted = Math.min(1, gated * 9.5);
      const compressed = Math.pow(boosted, 0.62);
      const nextLevel = Math.min(1, compressed * 1.08);

      const prev = smoothedLevelRef.current;
      const smoothing = nextLevel > prev ? 0.26 : 0.12;
      const smoothed = prev * (1 - smoothing) + nextLevel * smoothing;
      smoothedLevelRef.current = smoothed;
      onLevelChange?.(smoothed);

      meterFrameRef.current = requestAnimationFrame(tick);
    };

    stopMetering();
    meterFrameRef.current = requestAnimationFrame(tick);
  }

  async function toggleAudio() {
    setAudioError(null);

    if (isPlaying) {
      if (fadeTimerRef.current !== null) {
        clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      soloRef.current?.pause();
      groupRef.current?.pause();
      stopMetering();
      setIsPlaying(false);
      onPlaybackChange?.(false);
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
      startMetering();
      setIsPlaying(true);
      onPlaybackChange?.(true);
    } catch {
      setAudioError(
        "Unable to start audio. Make sure /public/audio/2to1-solo.mp3 and /public/audio/2to1-group.mp3 exist, then try again.",
      );
      onPlaybackChange?.(false);
    }
  }

  const modeLabel = mode === "group" ? "Social listening" : "Solo listening";

  if (variant === "overlay") {
    return (
      <>
        <button
          type="button"
          onClick={toggleAudio}
          aria-label={isPlaying ? "Stop audio" : "Play audio"}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-zinc-500 bg-zinc-800/90 text-zinc-100 shadow-lg transition hover:border-zinc-300 hover:bg-zinc-700 md:h-20 md:w-20"
        >
          {isPlaying ? <StopIcon /> : <PlayIcon />}
        </button>
        {audioError && <p className="mt-3 text-center text-sm text-rose-400">{audioError}</p>}
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Audio</p>
          <p className="text-sm font-medium text-zinc-100">{modeLabel}</p>
        </div>
        <button
          type="button"
          onClick={toggleAudio}
          className="rounded-full border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-400 hover:bg-zinc-800"
        >
          {isPlaying ? "Stop" : "Play"}
        </button>
      </div>

      {audioError && <p className="mt-2 text-sm text-rose-400">{audioError}</p>}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 md:h-8 md:w-8"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 6v12l10-6-10-6z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 md:h-8 md:w-8"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}
