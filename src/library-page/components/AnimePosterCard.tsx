import React from 'react';
import type { LibraryAnime } from '../types';

interface Props {
  anime: LibraryAnime;
  isExpanded: boolean;
  onClick: () => void;
}

export function AnimePosterCard({ anime, isExpanded, onClick }: Props) {
  const posterUrl = anime.posterPath
    ? `animecix-library://posters/${anime.posterPath.split('/').pop() ?? ''}`
    : '';

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      style={{
        aspectRatio: '2 / 3',
        borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg-secondary)',
        position: 'relative', cursor: 'pointer',
        transition: 'transform 0.15s ease',
        transform: isExpanded ? 'scale(1)' : undefined,
        outline: isExpanded ? '2px solid var(--accent)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isExpanded) (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = '';
      }}
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={anime.animeTitle}
          loading="lazy"
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
          }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'var(--bg-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 32,
        }}>
          {anime.animeTitle.charAt(0)}
        </div>
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '60%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Title */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8, right: 8,
        fontSize: 16, fontWeight: 600, lineHeight: '1.3',
        color: '#f9fafb',
        overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {anime.animeTitle}
      </div>

      {/* Episode count chip */}
      <div style={{
        position: 'absolute', bottom: 8, right: 8,
        fontSize: 13, fontWeight: 600, lineHeight: '1.4',
        color: 'var(--text-muted)',
      }}>
        {anime.episodeCount} bölüm
      </div>
    </div>
  );
}
