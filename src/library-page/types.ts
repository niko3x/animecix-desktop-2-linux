// Library types -- mirrors animecix-api.d.ts LibraryAnime / LibraryEpisode
// Keep in sync with types/animecix-api.d.ts

export interface LibraryAnime {
  animeTitle: string;
  posterPath: string;
  episodeCount: number;
}

export interface LibraryEpisode {
  episodeId: string;
  animeTitle: string;
  seasonNumber: string;
  episodeNumber: string;
  translator: string;
  source: 'download' | 'cache';
  sizeBytes: number;
  createdAt: number;
  offlineUrl: string;
}
