import { describe, it, expect } from 'vitest';

describe('library-protocol', () => {
  describe('resolveAssetPath', () => {
    it.todo('resolves normal paths within basePath');
    it.todo('rejects path traversal with ../');
    it.todo('rejects path traversal with encoded %2e%2e');
    it.todo('returns index.html for root path /');
    it.todo('returns null for empty decoded path escaping base');
  });

  describe('getMimeType', () => {
    it.todo('returns correct MIME for .html');
    it.todo('returns correct MIME for .js');
    it.todo('returns correct MIME for .css');
    it.todo('returns correct MIME for .jpg and .jpeg');
    it.todo('returns application/octet-stream for unknown extension');
  });
});
