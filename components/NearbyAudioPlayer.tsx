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
  const [audioReady, setAudioReady] = useState(false);
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

    current.src = TRACKS[mode];
    current.load();

    if (!audioReady) return;

    current.play().catch(() => {
      setAudioReady(false);
    });
  }, [mode, audioReady]);

  const label = mode === "group" ? "Group mode" : "Solo mode";

  async function enableAudio() {
    const audio = audioRef.current;
    if (!audio) return;

    setAudioError(null);
    try {
      audio.src = TRACKS[mode];
      await audio.play();
      setAudioReady(true);
    } catch {
      setAudioError(
        "Unable to start audio. Add /public/audio/solo.mp3 and /public/audio/group.mp3, then tap Enable audio again.",
      );
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Audio experience</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
        </div>
        <button
          type="button"
          onClick={enableAudio}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {audioReady ? "Resume audio" : "Enable audio"}
        </button>
      </div>

      {audioError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{audioError}</p>}
    </div>
  );
}
