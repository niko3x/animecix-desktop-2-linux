import { describe, it, expect } from 'vitest';

describe('StorageService - episode_metadata', () => {
  describe('upsertEpisodeMetadata', () => {
    it.todo('inserts a new episode metadata row');
    it.todo('updates existing row on duplicate episodeId (INSERT OR REPLACE)');
    it.todo('stores source as download or cache correctly');
  });

  describe('getLibraryAnimes', () => {
    it.todo('returns empty array when no metadata exists');
    it.todo('groups episodes by anime_title and returns correct episodeCount');
    it.todo('returns posterPath from MAX aggregation');
  });

  describe('getLibraryEpisodes', () => {
    it.todo('returns empty array for unknown anime title');
    it.todo('returns episodes for a given anime title');
    it.todo('constructs offlineUrl with animecix-offline:// protocol');
    it.todo('orders by season_number then episode_number');
    it.todo('JOINs with download_queue and cache_index for size_bytes');
  });
});
