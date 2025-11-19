
export const cloudShader = `
struct Uniforms {
  resolution: vec2f,
  time: f32,
  padding0: f32,
  cameraPos: vec3f,
  padding1: f32,
  cameraDir: vec3f,
  padding2: f32,
  cameraUp: vec3f,
  padding3: f32,
  cameraRight: vec3f,
  padding4: f32,
  sunDir: vec3f,
  haze: f32,
  cloudColor: vec3f,
  densityMultiplier: f32,
  coverage: f32,
  windSpeed: f32,
  anisotropy: f32,
  steps: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  
  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  output.uv = pos[vertexIndex] * 0.5 + 0.5;
  return output;
}

// --- Advanced Noise Functions ---

fn hash(p: vec3f) -> f32 {
  var p3 = fract(p * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 3D Value Noise with cubic interpolation
fn noise(x: vec3f) -> f32 {
  let p = floor(x);
  let f = fract(x);
  let f2 = f * f * (3.0 - 2.0 * f); // Smoothstep curve
  
  let n = p.x + p.y * 57.0 + 113.0 * p.z;
  
  let a = hash(p + vec3f(0,0,0));
  let b = hash(p + vec3f(1,0,0));
  let c = hash(p + vec3f(0,1,0));
  let d = hash(p + vec3f(1,1,0));
  let e = hash(p + vec3f(0,0,1));
  let f_val = hash(p + vec3f(1,0,1));
  let g = hash(p + vec3f(0,1,1));
  let h = hash(p + vec3f(1,1,1));
  
  let k0 = a;
  let k1 = b - a;
  let k2 = c - a;
  let k3 = e - a;
  let k4 = a - b - c + d;
  let k5 = a - c - e + g;
  let k6 = a - b - e + f_val;
  let k7 = -a + b + c - d + e - f_val - g + h;
  
  return k0 + k1*f2.x + k2*f2.y + k3*f2.z + k4*f2.x*f2.y + k5*f2.y*f2.z + k6*f2.z*f2.x + k7*f2.x*f2.y*f2.z;
}

// Rotation matrix helper to decorrelate FBM layers (avoids grid artifacts)
fn rotate_y(p: vec3f) -> vec3f {
    let c = 0.8;
    let s = 0.6;
    return vec3f(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}

// 4 Octaves FBM for base shapes with Domain Rotation
fn fbm_base(p: vec3f) -> f32 {
  var f = 0.0;
  var pos = p;
  var amp = 0.5;
  
  for (var i = 0; i < 4; i++) {
    f += amp * noise(pos);
    pos = rotate_y(pos) * 2.02; // Scale and Rotate
    amp *= 0.5;
  }
  
  return f / 0.9375; 
}

// 5 Octaves FBM for fine details
fn fbm_detail(p: vec3f) -> f32 {
  var f = 0.0;
  var pos = p;
  var amp = 0.5;
  
  for (var i = 0; i < 5; i++) {
    f += amp * noise(pos);
    pos = rotate_y(pos) * 2.03;
    amp *= 0.5;
  }
  
  return f / 0.96875;
}

fn remap(value: f32, original_min: f32, original_max: f32, new_min: f32, new_max: f32) -> f32 {
    return new_min + (clamp(value, original_min, original_max) - original_min) * (new_max - new_min) / (original_max - original_min);
}

// --- Physically Based Sky Shading ---

fn get_sky_color(rayDir: vec3f, sunDir: vec3f) -> vec3f {
    let sunY = max(sunDir.y, -0.1);
    
    // Define Palettes
    let zenithDay = vec3f(0.1, 0.4, 0.85);
    let horizonDay = vec3f(0.6, 0.8, 0.95);
    
    let zenithSunset = vec3f(0.05, 0.1, 0.25);
    let horizonSunset = vec3f(0.95, 0.45, 0.1);
    
    let zenithNight = vec3f(0.0, 0.0, 0.02);
    let horizonNight = vec3f(0.01, 0.02, 0.08);
    
    let dayFactor = smoothstep(0.0, 0.4, sunY);
    let nightFactor = smoothstep(0.1, -0.1, sunY);
    
    var zenith = mix(zenithSunset, zenithDay, dayFactor);
    zenith = mix(zenith, zenithNight, nightFactor);
    
    var horizon = mix(horizonSunset, horizonDay, dayFactor);
    horizon = mix(horizon, horizonNight, nightFactor);
    
    let upDot = max(rayDir.y, 0.0);
    var sky = mix(horizon, zenith, pow(upDot, 0.6));
    
    // Sun Glow (Atmospheric Scattering around sun)
    // Note: Sharp Sun Disk is removed from here to prevent it rendering on ground fog
    let sunDot = max(dot(rayDir, sunDir), 0.0);
    let sunColor = mix(vec3f(1.0, 0.3, 0.05), vec3f(1.0, 1.0, 0.9), smoothstep(0.0, 0.3, sunY));
    
    // Fade glow at night
    let nightFade = smoothstep(-0.1, 0.0, sunDir.y);
    let sunGlow = pow(sunDot, 128.0) * 0.6 * nightFade;
    
    sky += sunColor * sunGlow;
    
    return sky;
}

// --- Volumetric Multi-Layered Clouds ---

fn get_cloud_density(p: vec3f) -> f32 {
    // Global bounds
    if (p.y < 1.0 || p.y > 16.0) { return 0.0; }
    
    let time = u.time * u.windSpeed;
    var finalDensity = 0.0;

    // --- Macro Weather Map (Horizontal Variance) ---
    // Sample low frequency noise to create "cloud systems" vs empty sky
    let weather_scale = 0.03;
    let weather_p = p * weather_scale + vec3f(time * 0.1, 0.0, 0.0);
    let weather = noise(weather_p); // 0.0 to 1.0
    
    // Modulate the global coverage parameter locally
    let local_coverage = clamp(u.coverage + (weather - 0.5) * 1.2, 0.0, 1.0);
    let local_thresh = 1.0 - local_coverage;

    // --- Domain Warping for Irregularity ---
    let warp1 = noise(p * 0.15 + vec3f(time * 0.1, 0.0, 0.0));
    let warp2 = noise(p * 0.4 - vec3f(0.0, time * 0.2, 0.0));
    let warp = (warp1 + warp2 * 0.5);
    
    let p_distorted = p + vec3f(warp * 2.0, (warp - 0.6) * 6.0, warp * 1.5);

    // --- Layer 1: Low Altitude Cumulus ---
    if (p_distorted.y > 3.0 && p_distorted.y < 8.0) {
       let h = (p_distorted.y - 3.0) / 5.0; 
       let layerMask = smoothstep(0.0, 0.2, h) * smoothstep(1.0, 0.5, h);
       
       if (layerMask > 0.01) {
           let wind = vec3f(time * 0.5, 0.0, 0.0);
           let p_layer = p + wind;
           
           let base_noise = fbm_base(p_layer * 0.15);
           var d = remap(base_noise, local_thresh - 0.05, 1.0, 0.0, 1.0);
           
           if (d > 0.0) {
               let p_detail = (p_layer * 2.5);
               let detail_noise = fbm_detail(p_detail);
               d = d - detail_noise * 0.35 * (1.0 - d); 
               finalDensity += max(d, 0.0) * layerMask * 2.5;
           }
       }
    }

    // --- Layer 2: High Altitude Cirrus ---
    if (p_distorted.y > 10.0 && p_distorted.y < 14.0) {
        let weather_high_p = (p * vec3f(0.05, 0.0, 0.1)) + vec3f(time * 0.2, 0.0, 0.0);
        let weather_high = noise(weather_high_p);
        let local_cov_high = clamp(u.coverage + (weather_high - 0.5) * 0.8, 0.0, 1.0);
        let local_thresh_high = 1.0 - local_cov_high;
    
        let h = (p_distorted.y - 10.0) / 4.0;
        let layerMask = smoothstep(0.0, 0.2, h) * smoothstep(1.0, 0.8, h);
        
        if (layerMask > 0.01) {
            let wind = vec3f(time * 1.2, 0.0, 0.0); 
            let p_cirrus = (p + wind) * vec3f(0.1, 0.5, 0.1); 
            let noise_val = fbm_detail(p_cirrus);
            var d = remap(noise_val, local_thresh_high * 0.9, 1.0, 0.0, 1.0);
            finalDensity += max(d, 0.0) * layerMask * 1.8; 
        }
    }
    
    return finalDensity * u.densityMultiplier;
}

fn hg_phase(cosAngle: f32, g: f32) -> f32 {
    let g2 = g*g;
    return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * cosAngle, 1.5));
}

fn phase(cosAngle: f32) -> f32 {
    let forward = hg_phase(cosAngle, u.anisotropy);
    let backward = hg_phase(cosAngle, -0.3); 
    return mix(forward, backward, 0.4);
}

fn get_light(p: vec3f, rayDir: vec3f, sunDir: vec3f, density: f32) -> vec3f {
    let stepSize = 1.0;
    var lightPos = p;
    var shadowDensity = 0.0;
    
    for (var i = 0; i < 4; i++) {
        lightPos += sunDir * stepSize;
        if (lightPos.y > 16.0) { break; }
        shadowDensity += get_cloud_density(lightPos) * stepSize;
    }
    
    let directLight = exp(-shadowDensity * 1.0); 
    let powder = 1.0 - exp(-density * 2.0); 
    
    let cosAngle = dot(rayDir, sunDir);
    let ph = phase(cosAngle);
    
    let skyAmbientRaw = get_sky_color(vec3f(0.0, 1.0, 0.0), sunDir);
    let skyAmbient = mix(skyAmbientRaw, vec3f(dot(skyAmbientRaw, vec3f(0.33))), 0.6);
    let groundAmbient = vec3f(0.1, 0.1, 0.12) * 0.3;
    
    let h = clamp((p.y - 3.0) / 11.0, 0.0, 1.0);
    let ambient = mix(groundAmbient, skyAmbient * 0.8, h);
    
    let sunColor = mix(vec3f(1.0, 0.4, 0.1), vec3f(1.0, 0.95, 0.9), smoothstep(0.0, 0.3, sunDir.y));
    
    // Fade out direct light if sun is down
    let sunPower = smoothstep(-0.1, 0.1, sunDir.y);
    
    let finalLight = (sunColor * directLight * ph * powder * 6.0 * sunPower) + ambient;
    
    return finalLight * u.cloudColor;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let aspect = u.resolution.x / u.resolution.y;
    let ndc = (uv - 0.5) * 2.0;
    let screenPos = vec2f(ndc.x * aspect, ndc.y);
    
    let rayDir = normalize(u.cameraDir + screenPos.x * u.cameraRight + screenPos.y * u.cameraUp);
    
    // Background Sky (Gradient + Glow, no sharp sun disk)
    var col = get_sky_color(rayDir, u.sunDir);

    // Add Sharp Sun Disk explicitly to sky layer
    let sunDot = max(dot(rayDir, u.sunDir), 0.0);
    let sunDisk = smoothstep(0.999, 0.9995, sunDot);
    let sunY = max(u.sunDir.y, -0.1);
    let sunVis = smoothstep(-0.05, 0.05, u.sunDir.y); // Fade out when sun sets below horizon
    let sunDiskColor = mix(vec3f(1.0, 0.3, 0.05), vec3f(1.0, 1.0, 0.9), smoothstep(0.0, 0.3, sunY));
    
    col += sunDiskColor * sunDisk * 10.0 * sunVis;

    // --- Ground Rendering ---
    if (rayDir.y < 0.0) {
        let tGround = -u.cameraPos.y / rayDir.y;
        
        if (tGround > 0.0) {
             let pGround = u.cameraPos + rayDir * tGround;
             
             var gCol = vec3f(0.02, 0.02, 0.03); 
             let scale = 0.25;
             let f = floor(pGround.xz * scale);
             if (fract((f.x + f.y) * 0.5) > 0.01) {
                 gCol = vec3f(0.04, 0.04, 0.05);
             }
             
             let fogDist = tGround;
             let fogAmount = 1.0 - exp(-fogDist * 0.02 * (1.0 + u.haze * 5.0));
             // Get fog color from sky function (which has NO sharp sun disk now)
             let fogColor = get_sky_color(vec3f(rayDir.x, 0.0, rayDir.z), u.sunDir);
             
             // This overwrites the sky+disk color, ensuring sun doesn't render "behind" ground
             col = mix(gCol, fogColor, fogAmount);
        }
    }

    // --- Cloud Raymarching ---
    let cloudBottom = 1.0; 
    let cloudTop = 16.0;
    
    var tStart = 0.0;
    var tEnd = 0.0;
    var march = false;
    
    if (u.cameraPos.y < cloudBottom) {
        if (rayDir.y > 0.0) { 
            tStart = (cloudBottom - u.cameraPos.y) / rayDir.y;
            tEnd = (cloudTop - u.cameraPos.y) / rayDir.y;
            march = true;
        }
    } else if (u.cameraPos.y > cloudTop) {
        if (rayDir.y < 0.0) {
            tStart = (cloudTop - u.cameraPos.y) / rayDir.y;
            tEnd = (cloudBottom - u.cameraPos.y) / rayDir.y;
            march = true;
        }
    } else {
        tStart = 0.0;
        if (rayDir.y > 0.0) {
            tEnd = (cloudTop - u.cameraPos.y) / rayDir.y;
        } else {
            tEnd = (cloudBottom - u.cameraPos.y) / rayDir.y;
        }
        march = true;
    }
    
    if (march) {
        var t = tStart;
        var transmittance = 1.0;
        var scatteredLight = vec3f(0.0);
        
        // Track weighted depth for correct fog application
        var weightedDepth = 0.0;
        var totalAlpha = 0.0;
        
        let steps = i32(u.steps); 
        let stepSize = (tEnd - tStart) / f32(steps);
        
        let jitter = fract(sin(dot(uv, vec2f(12.9898,78.233))) * 43758.5453);
        t += stepSize * jitter;
        
        for (var i = 0; i < 128; i++) {
            if (i >= steps || transmittance < 0.01 || t > tEnd) { break; }
            
            let p = u.cameraPos + rayDir * t;
            let density = get_cloud_density(p);
            
            if (density > 0.001) {
                let light = get_light(p, rayDir, u.sunDir, density);
                
                let extinction = density * 0.8;
                let stepTrans = exp(-extinction * stepSize);
                let absorbed = transmittance * (1.0 - stepTrans);
                
                // Accumulate opacity-weighted depth
                weightedDepth += t * absorbed;
                totalAlpha += absorbed;
                
                scatteredLight += light * absorbed;
                transmittance *= stepTrans;
            }
            
            t += stepSize;
        }
        
        // Calculate average depth of the visible cloud surface
        var avgCloudDist = tEnd; 
        if (totalAlpha > 0.001) {
            avgCloudDist = weightedDepth / totalAlpha;
        }
        
        // --- Correct Atmospheric Blending ---
        let fogDensity = 0.04 * (1.0 + u.haze * 2.0);
        let T_atm = exp(-avgCloudDist * fogDensity);
        let horizonColor = get_sky_color(vec3f(rayDir.x, 0.0, rayDir.z), u.sunDir);
        
        let cloudOpacity = 1.0 - transmittance;
        let foggedCloud = scatteredLight * T_atm + horizonColor * (1.0 - T_atm) * cloudOpacity;
        
        // Composite over background
        col = col * transmittance + foggedCloud;
    }
    
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    col = clamp((col * (a * col + b)) / (col * (c * col + d) + e), vec3f(0.0), vec3f(1.0));
    col = pow(col, vec3f(1.0/2.2)); 
    
    return vec4f(col, 1.0);
}
`
