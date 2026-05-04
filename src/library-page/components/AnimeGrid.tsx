import React, { useRef, useEffect } from 'react';
import type { LibraryAnime } from '../types';
import { AnimePosterCard } from './AnimePosterCard';
import { EpisodeListExpand } from './EpisodeListExpand';

interface Props {
  animes: LibraryAnime[];
  expandedAnime: string | null;
  onCardClick: (animeTitle: string) => void;
  onDeleteEpisode: (episodeId: string, source: 'download' | 'cache') => void;
}

export function AnimeGrid({ animes, expandedAnime, onCardClick, onDeleteEpisode }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const colCount = useColumnCount(gridRef);

  const items: React.ReactNode[] = [];

  animes.forEach((anime, idx) => {
    items.push(
      <AnimePosterCard
        key={anime.animeTitle}
        anime={anime}
        isExpanded={expandedAnime === anime.animeTitle}
        onClick={() => onCardClick(anime.animeTitle)}
      />
    );

    // Insert expand panel after the last card in the current row
    const isLastInRow = (idx + 1) % colCount === 0 || idx === animes.length - 1;
    const rowContainsExpanded = expandedAnime != null && (() => {
      const rowStart = Math.floor(idx / colCount) * colCount;
      const rowEnd = Math.min(rowStart + colCount, animes.length);
      return animes.slice(rowStart, rowEnd).some((a) => a.animeTitle === expandedAnime);
    })();

    if (isLastInRow && rowContainsExpanded) {
      items.push(
        <EpisodeListExpand
          key={`expand-${expandedAnime}`}
          animeTitle={expandedAnime!}
          onDeleteEpisode={onDeleteEpisode}
        />
      );
    }
  });

  return (
    <div
      ref={gridRef}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 16,
      }}
    >
      {items}
    </div>
  );
}

function useColumnCount(ref: React.RefObject<HTMLDivElement | null>): number {
  const [cols, setCols] = React.useState(4);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      const minCol = 160 + 16; // minmax + gap
      setCols(Math.max(1, Math.floor((width + 16) / minCol)));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return cols;
}
