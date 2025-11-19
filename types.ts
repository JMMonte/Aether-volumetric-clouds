
export interface CloudParams {
  density: number; // 0.0 to 1.0 (multiplier)
  coverage: number; // 0.0 to 1.0 (threshold)
  sunX: number;
  sunY: number;
  sunZ: number;
  windSpeed: number;
  colorR: number;
  colorG: number;
  colorB: number;
  scatteringAnisotropy: number; // 0.0 to 0.99
  resolution: number; // 0.1 to 1.0 (Scaling factor)
  steps: number; // 16 to 128 (Raymarching steps)
  haze: number; // 0.0 to 1.0
}

export const DEFAULT_PARAMS: CloudParams = {
  density: 1.8,
  coverage: 0.6,
  sunX: 0.6,
  sunY: 0.2, // Low sun for Sunset/Golden Hour effect
  sunZ: 0.4,
  windSpeed: 0.5,
  colorR: 1.0,
  colorG: 1.0,
  colorB: 1.0,
  scatteringAnisotropy: 0.8,
  resolution: 0.5, 
  steps: 64,
  haze: 0.2
};