import React from 'react';
import type { LibraryEpisode } from '../types';
import { TypeBadge } from './TypeBadge';

interface Props {
  episode: LibraryEpisode;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function EpisodeRow({ episode }: Props) {
  const handlePlay = async () => {
    await window.animecix?.playOfflineEpisode(episode.episodeId);
  };

  const label = episode.seasonNumber
    ? `S${episode.seasonNumber}E${episode.episodeNumber}`
    : `Bölüm ${episode.episodeNumber}`;

  return (
    <div
      style={{
        height: 48, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: 14, fontWeight: 400,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = '';
      }}
    >
      <TypeBadge source={episode.source} />

      <span style={{ fontWeight: 600, fontSize: 14, minWidth: 70 }}>
        {label}
      </span>

      <span style={{
        flex: 1, color: 'var(--text-muted)',
        fontSize: 13, fontWeight: 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {episode.translator}
      </span>

      <span style={{
        color: 'var(--text-muted)', fontSize: 13, fontWeight: 400,
        minWidth: 60, textAlign: 'right',
      }}>
        {formatBytes(episode.sizeBytes)}
      </span>

      <button
        onClick={handlePlay}
        style={{
          background: 'var(--accent)', color: '#fff',
          fontSize: 13, fontWeight: 600, lineHeight: '1.4',
          padding: '6px 12px', borderRadius: 4,
          marginLeft: 8,
        }}
      >
        İzle
      </button>
    </div>
  );
}
