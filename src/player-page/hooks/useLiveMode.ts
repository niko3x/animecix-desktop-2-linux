import { useState, useCallback, useEffect } from 'react';
import type { MediaPlayerInstance } from '@vidstack/react';

interface LiveModeState {
  enabled: boolean;
  viewerCount: number;
}

export function useLiveMode(playerRef: React.RefObject<MediaPlayerInstance | null>) {
  const [liveState, setLiveState] = useState<LiveModeState>({
    enabled: false,
    viewerCount: 0,
  });

  const setLiveMode = useCallback(
    (enabled: boolean) => {
      setLiveState((prev) => ({ ...prev, enabled }));
      if (enabled) {
        playerRef.current?.play().catch(() => {});
      }
    },
    [playerRef]
  );

  const liveSeek = useCallback(
    (time: number) => {
      if (playerRef.current) {
        playerRef.current.currentTime = time;
      }
    },
    [playerRef]
  );

  const updateViewerCount = useCallback((count: number) => {
    setLiveState((prev) => ({ ...prev, viewerCount: count }));
  }, []);

  const endLiveMode = useCallback(() => {
    setLiveState({ enabled: false, viewerCount: 0 });
  }, []);

  // Auto-resume if paused in live mode
  useEffect(() => {
    if (!liveState.enabled) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (player && player.paused && player.state.canPlay) {
        player.play().catch(() => {});
      }
    }, 500);

    return () => clearInterval(interval);
  }, [liveState.enabled, playerRef]);

  // Block keyboard shortcuts in live mode
  useEffect(() => {
    if (!liveState.enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') return;

      const blocked = [
        'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'KeyJ', 'KeyK', 'KeyL', 'Home', 'End',
      ];
      if (blocked.includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [liveState.enabled]);

  return { liveState, setLiveMode, liveSeek, updateViewerCount, endLiveMode };
}
