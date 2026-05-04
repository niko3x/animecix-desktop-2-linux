import { useState, useEffect, useCallback } from 'react';
import type { LibraryAnime, LibraryEpisode } from '../types';

declare global {
  interface Window {
    animecix?: {
      getLibraryAnimes: () => Promise<LibraryAnime[]>;
      getLibraryEpisodes: (animeTitle: string) => Promise<LibraryEpisode[]>;
      showLibrary: () => Promise<void>;
      hideLibrary: () => Promise<void>;
      playOfflineEpisode: (episodeId: string) => Promise<void>;
      deleteDownload: (episodeId: string) => Promise<void>;
      deleteCache: (episodeId: string) => Promise<void>;
      isOnline: () => boolean;
    };
  }
}

export function useLibraryData() {
  const [animes, setAnimes] = useState<LibraryAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.animecix?.getLibraryAnimes();
      setAnimes(result ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { animes, loading, error, refresh };
}

export function useEpisodeData(animeTitle: string | null) {
  const [episodes, setEpisodes] = useState<LibraryEpisode[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEpisodes = useCallback(() => {
    if (!animeTitle) {
      setEpisodes([]);
      return;
    }
    setLoading(true);
    window.animecix?.getLibraryEpisodes(animeTitle)
      .then((result) => setEpisodes(result ?? []))
      .catch(() => setEpisodes([]))
      .finally(() => setLoading(false));
  }, [animeTitle]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  return { episodes, loading, refresh: fetchEpisodes };
}
