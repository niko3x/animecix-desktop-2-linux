import type { UpscalePreset, ColorFilters, EnhancementStats } from '../hooks/useVideoEnhancement';
import './EnhancementPanel.css';

interface Props {
  preset: UpscalePreset;
  onPresetChange: (preset: UpscalePreset) => void;
  filters: ColorFilters;
  onFiltersChange: (filters: Partial<ColorFilters>) => void;
  stats: EnhancementStats;
  isActive: boolean;
  panelOpen: boolean;
  onPanelToggle: () => void;
}

const PRESETS: { value: UpscalePreset; label: string; desc: string }[] = [
  { value: 'off', label: 'Kapalı', desc: 'Orijinal kalite' },
  { value: 'light', label: 'Hafif', desc: 'CNN Upscale (2x)' },
  { value: 'balanced', label: 'Dengeli', desc: 'Restore + Upscale + CAS + Deband' },
  { value: 'maximum', label: 'Maksimum', desc: 'Full Restore + Upscale + Deblur + CAS' },
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="ve-slider">
      <div className="ve-slider-header">
        <span>{label}</span>
        <span className="ve-slider-value">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export function EnhancementPanel({
  preset,
  onPresetChange,
  filters,
  onFiltersChange,
  stats,
  isActive,
  panelOpen,
  onPanelToggle,
}: Props) {
  return (
    <>
      <button
        className={`ve-toggle-btn ${isActive ? 'active' : ''}`}
        onClick={onPanelToggle}
        title="Video Kalite Artırma"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
        </svg>
      </button>

      {panelOpen && (
        <div className="ve-panel" onClick={(e) => e.stopPropagation()}>
          <div className="ve-panel-header">
            <span>Video Kalitesi</span>
            <button className="ve-close-btn" onClick={onPanelToggle}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          <div className="ve-section">
            <div className="ve-section-title">Upscale Modu</div>
            <div className="ve-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  className={`ve-preset-btn ${preset === p.value ? 'selected' : ''}`}
                  onClick={() => onPresetChange(p.value)}
                >
                  <span className="ve-preset-label">{p.label}</span>
                  <span className="ve-preset-desc">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ve-section">
            <div className="ve-section-title">Renk Filtreleri</div>
            <Slider
              label="Parlaklık"
              value={filters.brightness}
              min={0.5}
              max={1.5}
              step={0.05}
              onChange={(v) => onFiltersChange({ brightness: v })}
            />
            <Slider
              label="Kontrast"
              value={filters.contrast}
              min={0.5}
              max={1.5}
              step={0.05}
              onChange={(v) => onFiltersChange({ contrast: v })}
            />
            <Slider
              label="Doygunluk"
              value={filters.saturate}
              min={0.5}
              max={2}
              step={0.05}
              onChange={(v) => onFiltersChange({ saturate: v })}
            />
            <button
              className="ve-reset-btn"
              onClick={() => onFiltersChange({ brightness: 1, contrast: 1, saturate: 1 })}
            >
              Sıfırla
            </button>
          </div>

          {isActive && (
            <div className="ve-stats">
              <span>{stats.fps} FPS</span>
              <span>{stats.frameTime.toFixed(1)}ms</span>
              <span>{stats.resolution}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
