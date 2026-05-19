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
  debug: string;
}

export class VideoEnhancementRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private videoWidth = 0;
  private videoHeight = 0;
  private frameCount = 0;
  private fpsTimestamp = 0;
  private lastFrameTime = 0;
  private currentFps = 0;
  private active = false;
  private debugInfo = '';

  static isSupported(): boolean {
    return !!navigator.gpu;
  }

  static async diagnose(): Promise<string> {
    const lines: string[] = [];

    if (!navigator.gpu) {
      lines.push('navigator.gpu: YOK');
      return lines.join('\n');
    }
    lines.push('navigator.gpu: OK');

    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) {
        lines.push('adapter: NULL');
        return lines.join('\n');
      }
      lines.push(`adapter: ${adapter.info?.vendor || 'OK'}`);

      const device = await adapter.requestDevice();
      lines.push('device: OK');
      device.destroy();
    } catch (e) {
      lines.push(`hata: ${e}`);
    }

    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video) {
      lines.push(`video: ${video.videoWidth}x${video.videoHeight} ready=${video.readyState}`);
    } else {
      lines.push('video: BULUNAMADI');
    }

    return lines.join('\n');
  }

  async start(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    preset: UpscalePreset,
  ): Promise<void> {
    if (preset === 'off') {
      this.debugInfo = 'preset: off';
      return;
    }

    if (!navigator.gpu) {
      this.debugInfo = 'WebGPU desteklenmiyor';
      throw new Error('WebGPU not supported');
    }

    this.canvas = canvas;
    this.videoWidth = video.videoWidth;
    this.videoHeight = video.videoHeight;
    this.active = true;
    this.debugInfo = `init: ${this.videoWidth}x${this.videoHeight}`;

    const targetW = this.videoWidth * 2;
    const targetH = this.videoHeight * 2;
    canvas.width = targetW;
    canvas.height = targetH;

    try {
      const { render } = await import('anime4k-webgpu');
      this.debugInfo = `anime4k loaded, building ${preset}...`;

      const pipelineBuilder = await this.buildPipelineFactory(preset, this.videoWidth, this.videoHeight, targetW, targetH);

      this.frameCount = 0;
      this.fpsTimestamp = performance.now();

      this.debugInfo = `render() calling...`;

      await render({
        video,
        canvas,
        pipelineBuilder,
      });

      this.debugInfo = `render() OK - ${targetW}x${targetH}`;
    } catch (e) {
      this.debugInfo = `HATA: ${e}`;
      throw e;
    }
  }

  stop(): void {
    this.active = false;
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
    }
  }

  getStats(): EnhancementStats {
    return {
      fps: this.currentFps,
      frameTime: this.lastFrameTime,
      resolution: this.active
        ? `${this.videoWidth}x${this.videoHeight} → ${this.videoWidth * 2}x${this.videoHeight * 2}`
        : '-',
      debug: this.debugInfo,
    };
  }

  applyColorFilters(filters: ColorFilters): void {
    if (!this.canvas) return;
    const parts: string[] = [];
    if (filters.brightness !== 1) parts.push(`brightness(${filters.brightness})`);
    if (filters.contrast !== 1) parts.push(`contrast(${filters.contrast})`);
    if (filters.saturate !== 1) parts.push(`saturate(${filters.saturate})`);
    this.canvas.style.filter = parts.length > 0 ? parts.join(' ') : '';
  }

  private async buildPipelineFactory(
    preset: UpscalePreset,
    nativeW: number,
    nativeH: number,
    targetW: number,
    targetH: number,
  ) {
    const anime4k = await import('anime4k-webgpu');

    const factory = (device: GPUDevice, inputTexture: GPUTexture): [import('anime4k-webgpu').Anime4KPipeline] => {
      if (preset === 'light') {
        return [
          new anime4k.ModeA({
            device,
            inputTexture,
            nativeDimensions: { width: nativeW, height: nativeH },
            targetDimensions: { width: targetW, height: targetH },
          }),
        ];
      }

      if (preset === 'balanced') {
        return [
          new anime4k.ModeB({
            device,
            inputTexture,
            nativeDimensions: { width: nativeW, height: nativeH },
            targetDimensions: { width: targetW, height: targetH },
          }),
        ];
      }

      // maximum
      return [
        new anime4k.ModeAA({
          device,
          inputTexture,
          nativeDimensions: { width: nativeW, height: nativeH },
          targetDimensions: { width: targetW, height: targetH },
        }),
      ];
    };

    return factory;
  }
}
