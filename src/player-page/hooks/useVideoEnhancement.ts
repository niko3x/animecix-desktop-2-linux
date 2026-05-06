import { useCallback, useEffect, useRef, useState } from 'react';
import type { Anime4KPipeline } from 'anime4k-webgpu';
import { CASPipeline, DebandPipeline } from '../video-enhancement/custom-pipelines';

export type UpscalePreset = 'off' | 'light' | 'balanced' | 'maximum';

export interface ColorFilters {
  brightness: number;
  contrast: number;
  saturate: number;
}

export interface EnhancementStats {
  fps: number;
  frameTime: number;
  resolution: string;
}

const DEFAULT_FILTERS: ColorFilters = { brightness: 1, contrast: 1, saturate: 1 };
const STORAGE_KEY = 'video-enhancement-preset';
const FILTERS_KEY = 'video-enhancement-filters';

const QUAD_WGSL = `
struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  var p = array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
  var u = array<vec2f,6>(vec2f(0,1),vec2f(1,1),vec2f(0,0),vec2f(0,0),vec2f(1,1),vec2f(1,0));
  var o: VO; o.pos = vec4f(p[i],0,1); o.uv = u[i]; return o;
}
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var t: texture_2d<f32>;
@fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(t, s, uv);
}`;

interface Session {
  device: GPUDevice;
  running: boolean;
}

function loadPreset(): UpscalePreset {
  return (localStorage.getItem(STORAGE_KEY) as UpscalePreset) || 'off';
}

function loadFilters(): ColorFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (raw) return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_FILTERS };
}

export function useVideoEnhancement(containerRef: React.RefObject<HTMLElement | null>) {
  const [preset, setPresetState] = useState<UpscalePreset>(loadPreset);
  const [filters, setFiltersState] = useState<ColorFilters>(loadFilters);
  const [stats, setStats] = useState<EnhancementStats>({ fps: 0, frameTime: 0, resolution: '-' });
  const [panelOpen, setPanelOpen] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  const isActive = preset !== 'off';

  const destroySession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.running = false;
      sessionRef.current.device.destroy();
      sessionRef.current = null;
    }
    const container = containerRef.current;
    if (container) container.innerHTML = '';
    setStats({ fps: 0, frameTime: 0, resolution: '-' });
  }, [containerRef]);

  const startRendering = useCallback(async (selectedPreset: UpscalePreset) => {
    const container = containerRef.current;
    if (!container || selectedPreset === 'off' || !navigator.gpu) return;

    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video || video.readyState < 2) return;

    destroySession();

    const nativeW = video.videoWidth;
    const nativeH = video.videoHeight;
    const videoRatio = nativeW / nativeH;
    const dpr = window.devicePixelRatio || 1;
    const maxW = Math.round(window.screen.width * dpr);
    const maxH = Math.round(window.screen.height * dpr);
    let canvasW = nativeW * 2;
    let canvasH = nativeH * 2;
    if (canvasW > maxW) { canvasW = maxW; canvasH = Math.round(canvasW / videoRatio); }
    if (canvasH > maxH) { canvasH = maxH; canvasW = Math.round(canvasH * videoRatio); }
    const resolution = `${nativeW}x${nativeH} → ${canvasW}x${canvasH}`;

    const canvas = document.createElement('canvas');
    canvas.className = 'enhancement-canvas';
    canvas.width = canvasW;
    canvas.height = canvasH;
    container.appendChild(canvas);

    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return;
      const device = await adapter.requestDevice();

      const session: Session = { device, running: true };
      sessionRef.current = session;

      const format = navigator.gpu.getPreferredCanvasFormat();
      const ctx = canvas.getContext('webgpu')!;
      ctx.configure({ device, format, alphaMode: 'premultiplied' });

      const inputTexture = device.createTexture({
        size: [nativeW, nativeH],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      const anime4k = await import('anime4k-webgpu');
      const pipelines = buildPipelines(anime4k, device, inputTexture, selectedPreset);

      const module = device.createShaderModule({ code: QUAD_WGSL });
      const renderPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      });
      const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
      const lastOutput = pipelines[pipelines.length - 1].getOutputTexture();
      const bindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: lastOutput.createView() },
        ],
      });

      let frameCount = 0;
      let fpsTime = performance.now();

      const loop = () => {
        if (!session.running) return;

        try {
          const t0 = performance.now();

          device.queue.copyExternalImageToTexture(
            { source: video },
            { texture: inputTexture },
            [nativeW, nativeH],
          );

          const encoder = device.createCommandEncoder();
          for (const p of pipelines) p.pass(encoder);

          const pass = encoder.beginRenderPass({
            colorAttachments: [{
              view: ctx.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            }],
          });
          pass.setPipeline(renderPipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(6);
          pass.end();
          device.queue.submit([encoder.finish()]);

          frameCount++;
          const elapsed = performance.now() - fpsTime;
          if (elapsed >= 1000) {
            setStats({
              fps: Math.round((frameCount / elapsed) * 1000),
              frameTime: Math.round((performance.now() - t0) * 10) / 10,
              resolution,
            });
            frameCount = 0;
            fpsTime = performance.now();
          }
        } catch {
          session.running = false;
          return;
        }

        video.requestVideoFrameCallback(loop);
      };

      video.requestVideoFrameCallback(loop);
    } catch (e) {
      console.error('Enhancement error:', e);
      destroySession();
    }
  }, [containerRef, destroySession]);

  useEffect(() => {
    if (!isActive) { destroySession(); return; }

    const tryStart = () => {
      const video = document.querySelector('video') as HTMLVideoElement | null;
      if (video && video.readyState >= 2) { startRendering(preset); return true; }
      return false;
    };
    if (tryStart()) return;

    const observer = new MutationObserver(() => {
      const video = document.querySelector('video') as HTMLVideoElement | null;
      if (video) {
        video.addEventListener('canplay', () => tryStart(), { once: true });
        if (video.readyState >= 2) tryStart();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); destroySession(); };
  }, [preset, isActive, startRendering, destroySession]);

  const setPreset = useCallback((newPreset: UpscalePreset) => {
    setPresetState(newPreset);
    localStorage.setItem(STORAGE_KEY, newPreset);
  }, []);

  const setFilters = useCallback((newFilters: Partial<ColorFilters>) => {
    setFiltersState(prev => {
      const updated = { ...prev, ...newFilters };
      localStorage.setItem(FILTERS_KEY, JSON.stringify(updated));
      const container = containerRef.current;
      const canvas = container?.querySelector('canvas');
      if (canvas) {
        const parts: string[] = [];
        if (updated.brightness !== 1) parts.push(`brightness(${updated.brightness})`);
        if (updated.contrast !== 1) parts.push(`contrast(${updated.contrast})`);
        if (updated.saturate !== 1) parts.push(`saturate(${updated.saturate})`);
        canvas.style.filter = parts.length > 0 ? parts.join(' ') : '';
      }
      return updated;
    });
  }, [containerRef]);

  return {
    preset, setPreset, filters, setFilters,
    isActive, stats, panelOpen, setPanelOpen,
  };
}

function buildPipelines(
  anime4k: typeof import('anime4k-webgpu'),
  device: GPUDevice,
  inputTexture: GPUTexture,
  preset: UpscalePreset,
): Anime4KPipeline[] {
  const clamp = new anime4k.ClampHighlights({ device, inputTexture });
  let prev = clamp.getOutputTexture();

  if (preset === 'light') {
    // Clamp → Upscale → CAS
    const upscale = new anime4k.CNNx2M({ device, inputTexture: prev });
    prev = upscale.getOutputTexture();
    const cas = new CASPipeline({ device, inputTexture: prev });
    cas.updateParam('strength', 0.4);
    return [clamp, upscale, cas];
  }

  if (preset === 'balanced') {
    // Clamp → Deband → Restore → Upscale → CAS
    const deband = new DebandPipeline({ device, inputTexture: prev });
    prev = deband.getOutputTexture();
    const restore = new anime4k.CNNM({ device, inputTexture: prev });
    prev = restore.getOutputTexture();
    const upscale = new anime4k.CNNx2M({ device, inputTexture: prev });
    prev = upscale.getOutputTexture();
    const cas = new CASPipeline({ device, inputTexture: prev });
    cas.updateParam('strength', 0.5);
    return [clamp, deband, restore, upscale, cas];
  }

  // maximum: Clamp → Deband → DoubleRestore → Upscale → CAS
  const deband = new DebandPipeline({ device, inputTexture: prev });
  prev = deband.getOutputTexture();
  const restore1 = new anime4k.CNNM({ device, inputTexture: prev });
  prev = restore1.getOutputTexture();
  const restore2 = new anime4k.CNNSoftM({ device, inputTexture: prev });
  prev = restore2.getOutputTexture();
  const upscale = new anime4k.CNNx2M({ device, inputTexture: prev });
  prev = upscale.getOutputTexture();
  const cas = new CASPipeline({ device, inputTexture: prev });
  cas.updateParam('strength', 0.6);
  return [clamp, deband, restore1, restore2, upscale, cas];
}
