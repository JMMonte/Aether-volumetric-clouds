
import React, { useRef, useEffect, useState } from 'react';
import { cloudShader } from '../shaders/cloudShader';
import { CloudParams } from '../types';

// WebGPU Type Definitions
declare global {
  interface Navigator {
    gpu: any;
  }

  type GPUCanvasContext = any;
  type GPUDevice = any;
  type GPURenderPipeline = any;
  type GPUBuffer = any;
  type GPURenderPassDescriptor = any;

  var GPUBufferUsage: {
    UNIFORM: number;
    COPY_DST: number;
  };
}

interface WebGPUCanvasProps {
  params: CloudParams;
}

const WebGPUCanvas: React.FC<WebGPUCanvasProps> = ({ params }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for mutable state in the render loop
  const contextRef = useRef<GPUCanvasContext | null>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const pipelineRef = useRef<GPURenderPipeline | null>(null);
  const uniformBufferRef = useRef<GPUBuffer | null>(null);
  
  // Camera state
  const cameraRef = useRef({
    phi: 0.2, // Look slightly up
    theta: 0, // Horizontal angle
    radius: 1.0, // Unused distance scaler
    x: 0,
    y: 1.0, // Start on ground level
    z: 0,
  });
  
  const mouseRef = useRef({ isDown: false, lastX: 0, lastY: 0 });
  const keysRef = useRef({ w: false, a: false, s: false, d: false, r: false, f: false });
  const lastFrameTimeRef = useRef(0);

  useEffect(() => {
    if (!navigator.gpu) {
      setError("WebGPU is not supported in this browser. Please try Chrome Canary or Edge.");
      return;
    }

    const initWebGPU = async () => {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          throw new Error("No GPU adapter found.");
        }
        const device = await adapter.requestDevice();
        deviceRef.current = device;

        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('webgpu') as unknown as GPUCanvasContext;
        if (!context) {
          throw new Error("Could not get WebGPU context.");
        }
        contextRef.current = context;

        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
          device,
          format: presentationFormat,
          alphaMode: 'premultiplied',
        });

        // Create Shader Module
        const shaderModule = device.createShaderModule({
          label: 'Cloud Shader',
          code: cloudShader,
        });

        // Create Pipeline
        const pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
          },
          fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{ format: presentationFormat }],
          },
          primitive: {
            topology: 'triangle-list',
          },
        });
        pipelineRef.current = pipeline;

        // Create Uniform Buffer
        // Size must be multiple of 16 bytes
        const uniformBufferSize = 256; // Safe padding
        const uniformBuffer = device.createBuffer({
          size: uniformBufferSize,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        uniformBufferRef.current = uniformBuffer;

      } catch (err: any) {
        setError(err.message);
      }
    };

    initWebGPU();
  }, []);

  // Animation Loop
  useEffect(() => {
    if (!deviceRef.current || !pipelineRef.current || !contextRef.current || !uniformBufferRef.current) return;
    
    let animationFrameId: number;
    const startTime = performance.now();
    lastFrameTimeRef.current = startTime;

    const render = () => {
      const device = deviceRef.current!;
      const pipeline = pipelineRef.current!;
      const context = contextRef.current!;
      const uniformBuffer = uniformBufferRef.current!;
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      const now = performance.now();
      const dt = Math.min((now - lastFrameTimeRef.current) / 1000, 0.1); // Cap dt to prevent huge jumps
      lastFrameTimeRef.current = now;

      // Movement Logic
      const moveSpeed = 5.0 * dt; // Adjust speed as needed
      if (keysRef.current.w || keysRef.current.s || keysRef.current.a || keysRef.current.d || keysRef.current.r || keysRef.current.f) {
        const { theta } = cameraRef.current;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);

        if (keysRef.current.w) {
          cameraRef.current.x += sinT * moveSpeed;
          cameraRef.current.z += cosT * moveSpeed;
        }
        if (keysRef.current.s) {
          cameraRef.current.x -= sinT * moveSpeed;
          cameraRef.current.z -= cosT * moveSpeed;
        }
        if (keysRef.current.d) {
          cameraRef.current.x += cosT * moveSpeed;
          cameraRef.current.z -= sinT * moveSpeed;
        }
        if (keysRef.current.a) {
          cameraRef.current.x -= cosT * moveSpeed;
          cameraRef.current.z += sinT * moveSpeed;
        }
        if (keysRef.current.r) {
          cameraRef.current.y += moveSpeed;
        }
        if (keysRef.current.f) {
          cameraRef.current.y -= moveSpeed;
        }

        // Clamp
        if(cameraRef.current.y < 0.1) cameraRef.current.y = 0.1;
        if(cameraRef.current.y > 100.0) cameraRef.current.y = 100.0;
      }

      // Update Resolution based on params.resolution
      // We limit the maximum texture size to avoid memory issues on some devices
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.floor(canvas.clientWidth * dpr * params.resolution);
      const targetHeight = Math.floor(canvas.clientHeight * dpr * params.resolution);

      // Only resize if dimensions change significantly
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
      }

      // Update Camera Vectors
      const { phi, theta, x, y, z } = cameraRef.current;
      // Convert spherical to cartesian direction
      const dirX = Math.cos(phi) * Math.sin(theta);
      const dirY = Math.sin(phi);
      const dirZ = Math.cos(phi) * Math.cos(theta);
      
      // World Up is (0, 1, 0)
      const worldUp = [0, 1, 0];
      
      // Right = Cross(Dir, WorldUp)
      let rightX = dirY * worldUp[2] - dirZ * worldUp[1];
      let rightY = dirZ * worldUp[0] - dirX * worldUp[2];
      let rightZ = dirX * worldUp[1] - dirY * worldUp[0];
      // Normalize Right
      const lenRight = Math.sqrt(rightX*rightX + rightY*rightY + rightZ*rightZ);
      if (lenRight > 0.0001) {
        rightX /= lenRight; rightY /= lenRight; rightZ /= lenRight;
      } else {
        rightX = 1; rightY = 0; rightZ = 0;
      }
      
      // Up = Cross(Right, Dir)
      const upX = rightY * dirZ - rightZ * dirY;
      const upY = rightZ * dirX - rightX * dirZ;
      const upZ = rightX * dirY - rightY * dirX;

      // Normalize Sun Direction
      const sunLen = Math.sqrt(params.sunX**2 + params.sunY**2 + params.sunZ**2);
      const sunDir = sunLen > 0 
        ? [params.sunX/sunLen, params.sunY/sunLen, params.sunZ/sunLen]
        : [0, 1, 0];

      // Upload Uniforms
      const time = (now - startTime) / 1000.0;
      
      const uniformData = new Float32Array([
        targetWidth, targetHeight, // Resolution (used for aspect calc in shader)
        time, 0.0, // Time + Padding
        x, y, z, 0.0, // Camera Pos + Padding
        dirX, dirY, dirZ, 0.0, // Camera Dir
        upX, upY, upZ, 0.0, // Camera Up
        rightX, rightY, rightZ, 0.0, // Camera Right
        sunDir[0], sunDir[1], sunDir[2], params.haze, // Sun Dir + Haze (packed into vec4 slot)
        params.colorR, params.colorG, params.colorB, params.density, // Color + Density
        params.coverage, params.windSpeed, params.scatteringAnisotropy, params.steps // Misc params packed
      ]);

      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // Render Pass
      const commandEncoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();

      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      };

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(pipeline);
      
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
        ],
      });
      
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(6); 
      passEncoder.end();

      device.queue.submit([commandEncoder.finish()]);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [params]);

  // Input Handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      mouseRef.current.isDown = true;
      mouseRef.current.lastX = e.clientX;
      mouseRef.current.lastY = e.clientY;
    };
    
    const onMouseUp = () => {
      mouseRef.current.isDown = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseRef.current.isDown) return;
      const deltaX = e.clientX - mouseRef.current.lastX;
      const deltaY = e.clientY - mouseRef.current.lastY;
      
      mouseRef.current.lastX = e.clientX;
      mouseRef.current.lastY = e.clientY;

      // Mouse control mapping
      cameraRef.current.theta += deltaX * 0.005;
      cameraRef.current.phi -= deltaY * 0.005;
      
      // Clamp vertical look to prevent flip (approx -85 to +85 degrees)
      cameraRef.current.phi = Math.max(-1.5, Math.min(1.5, cameraRef.current.phi));
    };
    
    const onWheel = (e: WheelEvent) => {
        // Move camera Y up/down
        cameraRef.current.y += e.deltaY * 0.01;
        // Clamp
        if(cameraRef.current.y < 0.1) cameraRef.current.y = 0.1;
        if(cameraRef.current.y > 100.0) cameraRef.current.y = 100.0;
        e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if user is typing in an input field (like the prompt input)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch(e.key.toLowerCase()) {
        case 'w': keysRef.current.w = true; break;
        case 'a': keysRef.current.a = true; break;
        case 's': keysRef.current.s = true; break;
        case 'd': keysRef.current.d = true; break;
        case 'r': keysRef.current.r = true; break;
        case 'f': keysRef.current.f = true; break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch(e.key.toLowerCase()) {
        case 'w': keysRef.current.w = false; break;
        case 'a': keysRef.current.a = false; break;
        case 's': keysRef.current.s = false; break;
        case 'd': keysRef.current.d = false; break;
        case 'r': keysRef.current.r = false; break;
        case 'f': keysRef.current.f = false; break;
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-red-500 p-10 text-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">WebGPU Error</h2>
          <p>{error}</p>
          <p className="mt-4 text-gray-400 text-sm">Ensure you are using a compatible browser (Chrome/Edge) and have hardware acceleration enabled.</p>
        </div>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="w-full h-full block" style={{ imageRendering: params.resolution < 1 ? 'pixelated' : 'auto' }} />;
};

export default WebGPUCanvas;