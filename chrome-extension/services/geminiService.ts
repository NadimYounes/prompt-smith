import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { RefinementResponse } from "../types";

export const refineUserPrompt = async (originalPrompt: string): Promise<RefinementResponse> => {
  // Move initialization inside the function so the app doesn't crash on start if the key is invalid.
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key is missing. Please add your API_KEY to the .env file and rebuild.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Refine this prompt: "${originalPrompt}"`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            refinedPrompt: { type: Type.STRING },
            critique: { type: Type.STRING },
            score: { type: Type.INTEGER }
          },
          required: ["refinedPrompt", "critique", "score"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    // response.text is already a JSON string because of responseMimeType
    const parsed: RefinementResponse = JSON.parse(text);
    return parsed;

  } catch (error) {
    console.error("Gemini Refinement Error:", error);
    throw new Error("Failed to refine prompt. Please check your API Key and network connection.");
  }
};