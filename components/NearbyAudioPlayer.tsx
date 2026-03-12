"use client";

import { useEffect, useRef, useState } from "react";

interface NearbyAudioPlayerProps {
  mode: "solo" | "group";
}

const TRACKS = {
  solo: "/audio/n2-solo.mp3",
  group: "/audio/n2-group.mp3",
};

export function NearbyAudioPlayer({ mode }: NearbyAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio(TRACKS.solo);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.75;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const current = audioRef.current;
    if (!current) return;

    const wasPlaying = !current.paused;
    current.src = TRACKS[mode];
    current.load();

    if (!wasPlaying || !isPlaying) return;

    current.play().catch(() => {
      setIsPlaying(false);
    });
  }, [mode, isPlaying]);

  async function toggleAudio() {
    const audio = audioRef.current;
    if (!audio) return;

    setAudioError(null);

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      audio.src = TRACKS[mode];
      await audio.play();
      setIsPlaying(true);
    } catch {
      setAudioError(
        "Unable to start audio. Add /public/audio/n2-solo.mp3 and /public/audio/n2-group.mp3, then try again.",
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
