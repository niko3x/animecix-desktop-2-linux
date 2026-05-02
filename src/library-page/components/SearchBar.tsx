import React, { useRef, useCallback, useEffect, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 200);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLocalValue('');
      onChange('');
    }
  }, [onChange]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <input
        type="text"
        placeholder="Anime ara..."
        value={localValue}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%', maxWidth: 480, height: 40,
          background: 'var(--bg-secondary)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, padding: '0 16px',
          color: 'var(--text-primary)', fontSize: 14,
          fontWeight: 400, lineHeight: '1.5',
          outline: 'none',
        }}
      />
    </div>
  );
}
