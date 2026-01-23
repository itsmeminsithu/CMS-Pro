import { GoogleGenAI, Type } from "@google/genai";

/**
 * Analyzes internal notes using Gemini AI to provide structured insights.
 */
export const analyzeNotes = async (notes: string, clientName: string) => {
  if (!notes || notes.trim().length < 5) {
    return "Notes are too short to provide a meaningful analysis.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following notes for the client "${clientName}":\n\n"${notes}"`,
      config: {
        systemInstruction: "You are a professional Thai Immigration Consultant assistant. Analyze notes and provide a concise summary with emojis. Focus on missing docs and deadlines.",
      },
    });
    return response.text;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Service unavailable.";
  }
};

/**
 * Parses raw flight schedule text into structured Easy Pass records.
 */
export const extractEasyPassData = async (rawText: string, todayDate: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Process this arrival manifest. Today's date is: ${todayDate}. Manifest text:\n\n${rawText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: "Arrival date (e.g. Jan 23)" },
              airport: { type: Type.STRING, description: "Airport code (BKK/DMK)" },
              flightNo: { type: Type.STRING, description: "Flight number" },
              time: { type: Type.STRING, description: "Arrival time" },
              visaType: { type: Type.STRING, description: "Visa type mentioned (Arrival, Ed Visa, etc.)" },
              process: { type: Type.STRING, description: "Status: 'done' if the date is in the past relative to today, else 'waiting'" },
              paxCount: { type: Type.INTEGER, description: "Number of people (pax) mentioned (e.g., '6 PAX' = 6, default 1)" },
              remarks: { type: Type.STRING, description: "Extra info" },
            },
            required: ["date", "airport", "flightNo", "time"],
          },
        },
        systemInstruction: `You are an Airport Immigration Data Officer. 
        Your task is to parse raw flight schedule text into a structured JSON manifest.
        
        Rules:
        1. Parse blocks of text that look like:
           Jan 23
           BKK / VZ721
           11:55 AM / Arrival
           6 PAX
        2. Extract: Date, Airport (BKK or DMK), Flight No, Time, Visa Type (e.g. Arrival, Ed Visa), and PAX count.
        3. DATE LOGIC: If the arrival date is BEFORE today's date (${todayDate}), set 'process' to 'done'. If it is today or in the future, set 'process' to 'waiting'.
        4. PAX LOGIC: Look for 'PAX' or 'People' keywords. If not mentioned, default to 1.
        5. DEDUPLICATION: If exactly the same date, flight, and time appear, only return one entry.
        6. Format output strictly as a JSON array.`,
      },
    });

    const jsonStr = response.text || "[]";
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Extraction failed:", error);
    return null;
  }
};
