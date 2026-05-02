import React from 'react';

interface Props {
  source: 'download' | 'cache';
}

export function TypeBadge({ source }: Props) {
  const isDownload = source === 'download';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 6px', borderRadius: 4,
      fontSize: 13, fontWeight: 600, lineHeight: '1.4',
      background: isDownload ? 'var(--download-badge-bg)' : 'var(--cache-badge-bg)',
      color: isDownload ? 'var(--text-primary)' : 'var(--cache-badge-text)',
    }}>
      {isDownload ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )}
      {isDownload ? 'İndirildi' : 'Önbellek'}
    </span>
  );
}
