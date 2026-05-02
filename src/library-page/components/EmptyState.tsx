import React from 'react';

interface Props {
  hasSearch: boolean;
}

export function EmptyState({ hasSearch }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh',
      color: 'var(--text-muted)', textAlign: 'center',
      padding: '0 32px',
    }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"
        style={{ marginBottom: 16 }}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
        {!hasSearch && <path d="M6 8l4 4m0-4L6 12" strokeOpacity="0.5" />}
      </svg>

      <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '1.2', color: 'var(--text-primary)', marginBottom: 8 }}>
        {hasSearch ? 'Sonuç bulunamadı' : 'Kütüphaneniz boş'}
      </div>
      <div style={{ fontSize: 14, fontWeight: 400, lineHeight: '1.5', maxWidth: 320 }}>
        {hasSearch
          ? 'Arama teriminizi değiştirmeyi deneyin.'
          : 'İndirdiğiniz veya izlediğiniz bölümler burada görünecek.'}
      </div>
    </div>
  );
}
