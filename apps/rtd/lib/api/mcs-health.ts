'use client';

import { useState, useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 15_000;

export function useMcsHealth() {
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function check() {
    try {
      const res = await fetch('/api/mcs/health', {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) { setConnected(false); return; }
      const body = await res.json() as { connected: boolean };
      setConnected(body.connected);
    } catch {
      setConnected(false);
    }
  }

  useEffect(() => {
    check();
    timerRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { connected };
}
