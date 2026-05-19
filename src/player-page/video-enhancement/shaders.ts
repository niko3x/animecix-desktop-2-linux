export const FULLSCREEN_QUAD_WGSL = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) idx: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1),
    vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1),
  );
  var uv = array<vec2f, 6>(
    vec2f(0, 1), vec2f(1, 1), vec2f(0, 0),
    vec2f(0, 0), vec2f(1, 1), vec2f(1, 0),
  );
  var out: VertexOutput;
  out.position = vec4f(pos[idx], 0, 1);
  out.texcoord = uv[idx];
  return out;
}

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;

@fragment
fn fs(@location(0) texcoord: vec2f) -> @location(0) vec4f {
  return textureSample(tex, texSampler, texcoord);
}
`;

export const CAS_SHADER_WGSL = /* wgsl */ `
@group(0) @binding(0) var tex_in: texture_2d<f32>;
@group(0) @binding(1) var tex_out: texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var<uniform> sharpness: f32;

@compute @workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {
  let dims = textureDimensions(tex_in);
  if (pixel.x >= dims.x || pixel.y >= dims.y) { return; }

  let pos = vec2i(pixel.xy);

  let a = textureLoad(tex_in, pos + vec2i(0, -1), 0).rgb;
  let b = textureLoad(tex_in, pos + vec2i(-1, 0), 0).rgb;
  let c = textureLoad(tex_in, pos, 0).rgb;
  let d = textureLoad(tex_in, pos + vec2i(1, 0), 0).rgb;
  let e = textureLoad(tex_in, pos + vec2i(0, 1), 0).rgb;

  let mnRGB = min(min(a, b), min(c, min(d, e)));
  let mxRGB = max(max(a, b), max(c, max(d, e)));

  let rcpMxRGB = vec3f(1.0) / max(mxRGB, vec3f(1e-5));
  let ampRGB = clamp(min(mnRGB, 2.0 - mxRGB) * rcpMxRGB, vec3f(0.0), vec3f(1.0));
  let ampRGB2 = ampRGB * ampRGB;

  let peak = vec3f(-1.0) / mix(vec3f(8.0), vec3f(5.0), ampRGB2);
  let w = peak * sharpness;
  let rcpWeight = vec3f(1.0) / (1.0 + 4.0 * w);

  let result = clamp((a * w + b * w + d * w + e * w + c) * rcpWeight, vec3f(0.0), vec3f(1.0));
  textureStore(tex_out, pixel.xy, vec4f(result, 1.0));
}
`;

export const DEBAND_SHADER_WGSL = /* wgsl */ `
@group(0) @binding(0) var tex_in: texture_2d<f32>;
@group(0) @binding(1) var tex_out: texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var<uniform> params: vec4f; // threshold, range, unused, unused

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

@compute @workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {
  let dims = textureDimensions(tex_in);
  if (pixel.x >= dims.x || pixel.y >= dims.y) { return; }

  let threshold = params.x / 255.0;
  let range_val = params.y;

  let center = textureLoad(tex_in, pixel.xy, 0);
  var avg = center;
  var count = 1.0;

  // Fixed seed per pixel — no per-frame variation to prevent temporal flickering
  let seed_base = vec2f(f32(pixel.x), f32(pixel.y));

  for (var i = 0u; i < 4u; i++) {
    let angle = hash(seed_base + vec2f(f32(i) * 3.17, f32(i) * 7.23)) * 6.283185;
    let dist = hash(seed_base + vec2f(f32(i) * 5.71, f32(i) * 2.31)) * range_val;
    let offset = vec2i(vec2f(cos(angle), sin(angle)) * dist);
    let samplePos = clamp(vec2i(pixel.xy) + offset, vec2i(0), vec2i(dims) - 1);
    let s = textureLoad(tex_in, vec2u(samplePos), 0);

    let diff = abs(s.rgb - center.rgb);
    if (all(diff < vec3f(threshold))) {
      avg += s;
      count += 1.0;
    }
  }

  let result = avg.rgb / count;
  textureStore(tex_out, pixel.xy, vec4f(clamp(result, vec3f(0.0), vec3f(1.0)), center.a));
}
`;
