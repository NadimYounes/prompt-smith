import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ASK_SYSTEM_INSTRUCTION, SYSTEM_INSTRUCTION } from "../constants";
import { RefinementResponse } from "../types";

export const invokeGeminiContentResponse = async (
  prompt: string,
  systemInstructions: string,
  responseSchemaProperties: any,
  requiredFields: Array<string>
) => {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error(
      "API Key is missing. Please add your API_KEY to the .env file and rebuild."
    );
  }
  const ai = new GoogleGenAI({ apiKey: apiKey });
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstructions,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: responseSchemaProperties,
          required: requiredFields,
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    // response.text is already a JSON string because of responseMimeType
    const parsed: RefinementResponse = JSON.parse(text);
    return parsed;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error(
      "Failed to run prompt. Please check your API Key and network connection."
    );
  }
};

export const refineUserPrompt = async (userPrompt: string) => {
  const result = await invokeGeminiContentResponse(
    `Refine User Prompt : ${userPrompt}`,
    SYSTEM_INSTRUCTION,
    {
      refinedPrompt: {type: Type.STRING},
      critique: {type: Type.STRING},
      score: { type: Type.INTEGER },
    },
    ["refinedPrompt", "critique", "score"]
  );

  return result;
};

export const askClarifyingQuestions = async (userPrompt: string) => {
  const result = await invokeGeminiContentResponse(
    `Analyze this prompt and ask clarifying questions: ${userPrompt}`,
    ASK_SYSTEM_INSTRUCTION,
    {
      questions: { 
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      reasoning: { type: Type.STRING }
    },
    ["questions", "reasoning"]
  );

  return result;
};