import React, { useEffect, useRef, useState } from 'react';
import { useEpisodeData } from '../hooks/useLibraryData';
import { EpisodeRow } from './EpisodeRow';

interface Props {
  animeTitle: string;
}

export function EpisodeListExpand({ animeTitle }: Props) {
  const { episodes, loading } = useEpisodeData(animeTitle);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setMaxHeight(contentRef.current.scrollHeight);
    }
  }, [episodes]);

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: 'var(--bg-secondary)',
      borderTop: '2px solid var(--accent)',
      borderRadius: '0 0 8px 8px',
      overflow: 'hidden',
      maxHeight: maxHeight > 0 ? maxHeight : 'none',
      transition: 'max-height 250ms ease',
    }}>
      <div ref={contentRef}>
        {loading ? (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 14 }}>
            Yukleniyor...
          </div>
        ) : episodes.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 14 }}>
            Bu anime icin bolum bulunamadi.
          </div>
        ) : (
          episodes.map((ep) => (
            <EpisodeRow key={ep.episodeId} episode={ep} />
          ))
        )}
      </div>
    </div>
  );
}
