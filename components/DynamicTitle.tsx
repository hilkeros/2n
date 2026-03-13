"use client";

import { useEffect, useState } from "react";

export function DynamicTitle({ enabled }: { enabled: boolean }) {
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsJoined(false);
      return;
    }

    let active = true;

    const syncJoinState = async () => {
      try {
        const response = await fetch("/api/join", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as { joined?: boolean };
        if (active) {
          setIsJoined(Boolean(payload.joined));
        }
      } catch {
        // Keep fallback title if join status fetch fails.
      }
    };

    const handleJoinState = (event: Event) => {
      const customEvent = event as CustomEvent<{ joined?: boolean }>;
      setIsJoined(Boolean(customEvent.detail?.joined));
    };

    void syncJoinState();
    window.addEventListener("n2:join-state", handleJoinState as EventListener);

    return () => {
      active = false;
      window.removeEventListener("n2:join-state", handleJoinState as EventListener);
    };
  }, [enabled]);

  return (
    <h1 className="mb-1 text-5xl font-bold text-zinc-100 md:text-6xl">
      {enabled && isJoined ? "2¹" : "2ⁿ"}
    </h1>
  );
}
