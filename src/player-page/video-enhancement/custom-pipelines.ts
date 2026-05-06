import type { Anime4KPipeline } from 'anime4k-webgpu';
import { CAS_SHADER_WGSL, DEBAND_SHADER_WGSL } from './shaders';

export class CASPipeline implements Anime4KPipeline {
  private outputTexture: GPUTexture;
  private pipeline: GPUComputePipeline;
  private bindGroup: GPUBindGroup;
  private strengthBuffer: GPUBuffer;
  private device: GPUDevice;
  private width: number;
  private height: number;

  constructor({ device, inputTexture }: { device: GPUDevice; inputTexture: GPUTexture }) {
    this.device = device;
    this.width = inputTexture.width;
    this.height = inputTexture.height;

    this.outputTexture = device.createTexture({
      size: [this.width, this.height],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    });

    this.strengthBuffer = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.strengthBuffer, 0, new Float32Array([0.5]));

    const module = device.createShaderModule({ code: CAS_SHADER_WGSL });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    this.pipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      compute: { module, entryPoint: 'computeMain' },
    });

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: this.outputTexture.createView() },
        { binding: 2, resource: { buffer: this.strengthBuffer } },
      ],
    });
  }

  updateParam(param: string, value: number): void {
    if (param === 'strength') {
      this.device.queue.writeBuffer(this.strengthBuffer, 0, new Float32Array([value]));
    }
  }

  pass(encoder: GPUCommandEncoder): void {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8));
    pass.end();
  }

  getOutputTexture(): GPUTexture {
    return this.outputTexture;
  }

  destroy(): void {
    this.outputTexture.destroy();
    this.strengthBuffer.destroy();
  }
}

export class DebandPipeline implements Anime4KPipeline {
  private outputTexture: GPUTexture;
  private pipeline: GPUComputePipeline;
  private bindGroup: GPUBindGroup;
  private paramsBuffer: GPUBuffer;
  private device: GPUDevice;
  private width: number;
  private height: number;
  private frameCount = 0;

  constructor({ device, inputTexture }: { device: GPUDevice; inputTexture: GPUTexture }) {
    this.device = device;
    this.width = inputTexture.width;
    this.height = inputTexture.height;

    this.outputTexture = device.createTexture({
      size: [this.width, this.height],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    });

    this.paramsBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.paramsBuffer, 0, new Float32Array([35, 16, 4, 0]));

    const module = device.createShaderModule({ code: DEBAND_SHADER_WGSL });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    this.pipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      compute: { module, entryPoint: 'computeMain' },
    });

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: this.outputTexture.createView() },
        { binding: 2, resource: { buffer: this.paramsBuffer } },
      ],
    });
  }

  updateParam(param: string, value: number): void {
    if (param === 'threshold') {
      const current = new Float32Array(4);
      current[0] = value;
      current[1] = 16;
      current[2] = 4;
      current[3] = this.frameCount;
      this.device.queue.writeBuffer(this.paramsBuffer, 0, current);
    }
  }

  pass(encoder: GPUCommandEncoder): void {
    this.frameCount++;
    this.device.queue.writeBuffer(this.paramsBuffer, 12, new Float32Array([this.frameCount % 1000]));

    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8));
    pass.end();
  }

  getOutputTexture(): GPUTexture {
    return this.outputTexture;
  }

  destroy(): void {
    this.outputTexture.destroy();
    this.paramsBuffer.destroy();
  }
}
