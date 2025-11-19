
import { GoogleGenAI, Type } from "@google/genai";
import { CloudParams, DEFAULT_PARAMS } from "../types";

export const generateCloudParams = async (prompt: string): Promise<CloudParams> => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not found, returning default params.");
    return DEFAULT_PARAMS;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate WebGPU volumetric cloud rendering parameters for the following description: "${prompt}".
      
      The engine supports multi-layered clouds and physically based sky shading.
      - **Low Layer (Cumulus)**: Puffy, billowy clouds (Altitude 3.0-7.0).
      - **High Layer (Cirrus)**: Wispy, streak-like clouds (Altitude 9.0-13.0).
      - **Sky Shading**: Responds to Sun Y position (Red Sunset, Blue Noon).
      - **Haze**: Atmospheric blending.
      
      Guidelines:
      - Density: 0.0 (clear) to 3.0 (thick storm). Affects both layers.
      - Coverage: 0.3 (sparse) to 0.9 (overcast).
      - Sun Position (X,Y,Z): Y determines sky color. 
        * Y < 0.1: Deep Sunset/Night.
        * Y = 0.1-0.2: Golden Hour (Orange).
        * Y > 0.4: Day (Blue).
      - Wind Speed: 0.0 to 2.0. Cirrus move faster by default.
      - Color (RGB): Base tint.
      - Anisotropy: 0.0 to 0.9 (silver lining near sun).
      - Haze: 0.0 (clear) to 1.0 (foggy).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            density: { type: Type.NUMBER },
            coverage: { type: Type.NUMBER },
            sunX: { type: Type.NUMBER },
            sunY: { type: Type.NUMBER },
            sunZ: { type: Type.NUMBER },
            windSpeed: { type: Type.NUMBER },
            colorR: { type: Type.NUMBER },
            colorG: { type: Type.NUMBER },
            colorB: { type: Type.NUMBER },
            scatteringAnisotropy: { type: Type.NUMBER },
            resolution: { type: Type.NUMBER },
            steps: { type: Type.NUMBER },
            haze: { type: Type.NUMBER },
          },
          required: ["density", "coverage", "sunX", "sunY", "sunZ", "windSpeed", "colorR", "colorG", "colorB", "scatteringAnisotropy", "haze"],
        },
      },
    });

    if (response.text) {
      const params = JSON.parse(response.text) as CloudParams;
      return { ...DEFAULT_PARAMS, ...params };
    }
    
    throw new Error("No response text generated");

  } catch (error) {
    console.error("Gemini generation failed:", error);
    return DEFAULT_PARAMS;
  }
};