import { describe, it, expect } from 'vitest';

describe('library IPC handlers', () => {
  describe('library:getAnimes', () => {
    it.todo('calls storage.getLibraryAnimes and returns result');
  });

  describe('library:getEpisodes', () => {
    it.todo('calls storage.getLibraryEpisodes with animeTitle parameter');
  });

  describe('library:playEpisode', () => {
    it.todo('hides library and navigates mainWindow to offline URL');
  });

  describe('downloadPoster', () => {
    it.todo('returns empty string for non-HTTPS poster URL');
    it.todo('skips download if poster file already exists');
  });
});
