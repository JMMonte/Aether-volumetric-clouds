import React, { useState } from 'react';
import WebGPUCanvas from './components/WebGPUCanvas';
import ControlPanel from './components/ControlPanel';
import { CloudParams, DEFAULT_PARAMS } from './types';

const App: React.FC = () => {
  const [params, setParams] = useState<CloudParams>(DEFAULT_PARAMS);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <WebGPUCanvas params={params} />
      </div>

      {/* UI Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Enable pointer events only for the control panel */}
        <div className="pointer-events-auto w-full h-full">
             <ControlPanel params={params} setParams={setParams} />
        </div>
      </div>
      
      {/* Branding / Info */}
      <div className="absolute bottom-4 left-6 z-0 pointer-events-none select-none opacity-70">
        <h1 className="text-white text-2xl font-light tracking-widest uppercase">Aether</h1>
        <p className="text-cyan-400 text-xs tracking-wider">Volumetric Engine v1.0</p>
      </div>
    </div>
  );
};

export default App;
