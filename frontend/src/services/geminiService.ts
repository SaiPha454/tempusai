import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const streamGeminiResponse = async (
  prompt: string,
  history: { role: string; parts: { text: string }[] }[],
  onChunk: (text: string) => void
) => {
  if (!ai) {
    onChunk("Error: API Key not configured. Please check your environment settings.");
    return;
  }

  try {
    // Use gemini-3-flash-preview as it is the stable recommended model for text tasks
    const model = 'gemini-3-flash-preview';
    
    const systemInstruction = `You are TempusAI, an intelligent academic scheduling assistant for a university. 
    You assist Dr. Aris Chandra, the Coordinator.
    
    Current Date: October 24, 2025.
    Semester: 2, 2025.
    
    Capabilities:
    - You know about course schedules, room availability, and professor assignments.
    - You can detect conflicts (double bookings).
    - You help manage exam timetables.
    
    Tone: Professional, helpful, concise, and academic.
    
    If asked about data you don't have, politely simulate a search or provide a plausible placeholder answer based on typical university structures, but mention you are simulating.
    `;

    // Construct the full prompt context
    const fullContents = [
      ...history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: h.parts
      })),
      { role: 'user', parts: [{ text: prompt }] }
    ];

    const response = await ai.models.generateContentStream({
      model,
      contents: fullContents,
      config: {
        systemInstruction,
      }
    });

    for await (const chunk of response) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    onChunk("\n\n*Error: Unable to connect to the AI service. Please verify your API key and network connection.*");
  }
};
