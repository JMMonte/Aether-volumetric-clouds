
import React, { useState, useEffect } from 'react';
import { CloudParams } from '../types';
import { generateCloudParams } from '../services/geminiService';

interface ControlPanelProps {
  params: CloudParams;
  setParams: (params: CloudParams) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ params, setParams }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const handleChange = (key: keyof CloudParams, value: number) => {
    setParams({ ...params, [key]: value });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    const newParams = await generateCloudParams(prompt);
    setParams(newParams);
    setIsGenerating(false);
  };

  return (
    <div className={`absolute top-4 right-4 bg-gray-900/80 backdrop-blur-md text-white p-5 rounded-xl border border-gray-700 shadow-2xl transition-all duration-300 max-h-[90vh] overflow-y-auto ${isOpen ? 'w-80' : 'w-12 h-12 p-0 overflow-hidden cursor-pointer'}`}>
      
      {/* Toggle Button */}
      <div className="absolute top-0 right-0 p-3 z-10" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? (
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        ) : (
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="m-auto mt-0.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        )}
      </div>

      {isOpen && (
        <div className="space-y-6 mt-2">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent mb-1">Aether Volumetrics</h2>
            <p className="text-xs text-gray-400">WebGPU Real-time Cloud Renderer</p>
          </div>

          {/* AI Generator Section */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-300">AI Parameter Generator</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="e.g., 'Stormy sunset', 'Cotton candy'"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !process.env.API_KEY}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-3 py-2 rounded transition-colors flex items-center justify-center"
              >
                {isGenerating ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                )}
              </button>
            </div>
            {!process.env.API_KEY && <p className="text-[10px] text-red-400">No API_KEY found. AI Disabled.</p>}
          </div>

          <div className="h-px bg-gray-700 my-2"></div>

           {/* Performance Settings */}
           <div className="space-y-3 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
             <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Performance</h3>
             <Slider label="Resolution Scale" value={params.resolution || 0.5} min={0.1} max={1.0} step={0.1} onChange={(v) => handleChange('resolution', v)} />
             <Slider label="Ray Steps" value={params.steps || 48} min={16} max={128} step={8} onChange={(v) => handleChange('steps', v)} />
           </div>

          {/* Manual Sliders */}
          <div className="space-y-4">
             <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Atmosphere</h3>
             <Slider label="Density" value={params.density} min={0} max={3} step={0.1} onChange={(v) => handleChange('density', v)} />
             <Slider label="Cloud Coverage" value={params.coverage} min={0} max={1} step={0.01} onChange={(v) => handleChange('coverage', v)} />
             <Slider label="Haze Amount" value={params.haze} min={0} max={1} step={0.01} onChange={(v) => handleChange('haze', v)} />
             <Slider label="Wind Speed" value={params.windSpeed} min={0} max={2} step={0.1} onChange={(v) => handleChange('windSpeed', v)} />
             <Slider label="Anisotropy (Phase)" value={params.scatteringAnisotropy} min={0} max={0.95} step={0.01} onChange={(v) => handleChange('scatteringAnisotropy', v)} />
             
             <div className="space-y-1">
               <label className="text-xs uppercase tracking-wider text-gray-500">Sun Direction</label>
               <div className="grid grid-cols-3 gap-2">
                  <NumberInput label="X" value={params.sunX} onChange={(v) => handleChange('sunX', v)} />
                  <NumberInput label="Y" value={params.sunY} onChange={(v) => handleChange('sunY', v)} />
                  <NumberInput label="Z" value={params.sunZ} onChange={(v) => handleChange('sunZ', v)} />
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-xs uppercase tracking-wider text-gray-500">Cloud Color</label>
               <div className="flex gap-2">
                  <div className="w-full h-4 rounded" style={{backgroundColor: `rgb(${params.colorR*255}, ${params.colorG*255}, ${params.colorB*255})`}}></div>
               </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumberInput label="R" value={params.colorR} onChange={(v) => handleChange('colorR', v)} />
                  <NumberInput label="G" value={params.colorG} onChange={(v) => handleChange('colorG', v)} />
                  <NumberInput label="B" value={params.colorB} onChange={(v) => handleChange('colorB', v)} />
               </div>
             </div>
          </div>
          
          <div className="mt-4 text-[10px] text-gray-500">
            <p>Controls: <b>WASD</b> to Move. <b>R/F</b> to Raise/Lower. Click & Drag to Look.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const Slider = ({ label, value, min, max, step, onChange }: { label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-xs">
      <span className="text-gray-300">{label}</span>
      <span className="text-cyan-400 font-mono">{value?.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value || min}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
    />
  </div>
);

const NumberInput = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
  <div className="flex flex-col bg-gray-800 rounded p-1">
    <span className="text-[10px] text-gray-500 text-center">{label}</span>
    <input 
      type="number" 
      step="0.1"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="bg-transparent text-center text-xs text-white focus:outline-none"
    />
  </div>
);

export default ControlPanel;