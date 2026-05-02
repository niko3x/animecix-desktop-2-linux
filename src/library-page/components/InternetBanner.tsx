import React from 'react';

interface Props {
  onGoToWebsite: () => void;
}

const isMac = navigator.platform.startsWith('Mac');

export function InternetBanner({ onGoToWebsite }: Props) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      height: 48, background: '#1f2937',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingLeft: isMac ? 80 : 16, paddingRight: 16,
      color: '#e5e7eb',
      // @ts-expect-error webkit property
      WebkitAppRegion: 'drag',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 400 }}>İnternet bağlantısı mevcut</span>
      </div>
      <button
        onClick={onGoToWebsite}
        style={{
          background: 'var(--accent)', color: '#fff',
          fontSize: 13, fontWeight: 600, lineHeight: '1.4',
          padding: '6px 14px', borderRadius: 4,
          // @ts-expect-error webkit property
          WebkitAppRegion: 'no-drag',
        }}
      >
        Siteye Dön
      </button>
    </div>
  );
}
