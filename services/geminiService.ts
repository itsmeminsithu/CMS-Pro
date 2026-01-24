
import { GoogleGenAI } from "@google/genai";

/**
 * Robustly extracts JSON from a string that might contain markdown or conversational text.
 */
const extractJson = (text: string) => {
  try {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();

    const firstBracket = text.indexOf('[');
    const firstBrace = text.indexOf('{');
    const lastBracket = text.lastIndexOf(']');
    const lastBrace = text.lastIndexOf('}');

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      if (lastBracket !== -1) return text.substring(firstBracket, lastBracket + 1);
    }
    if (firstBrace !== -1 && (lastBrace !== -1)) {
      return text.substring(firstBrace, lastBrace + 1);
    }

    return text.trim();
  } catch (e) {
    return "{}";
  }
};

export const lookupFlightDetails = async (flightNo: string, targetDate?: string) => {
  if (!flightNo || flightNo.trim().length < 2) return null;
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const dateHint = targetDate ? ` scheduled for ${targetDate}` : "for today's latest operation";
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Perform an exhaustive web search for the REAL-TIME flight telemetry of: ${flightNo} ${dateHint}.
      
      CRITICAL INSTRUCTIONS:
      1. ORIGIN/DESTINATION: Do NOT return 'TBA'. Find the actual 3-letter IATA codes (e.g., LHR, DXB, BKK).
      2. AIRLINE: Use the full commercial name (e.g., 'Thai Airways' instead of 'TG').
      3. STATUS: Identify if the flight has 'Landed', 'Arrived', 'In Air', or 'Scheduled'.
      4. TIMES: Provide Arrival Time in 24-hour format (HH:MM).
      
      Response MUST be a valid JSON block with these keys: 
      airline, origin, destination, departCountry, landedCountry, arrivalDate, arrivalTime, status.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = response.text || "{}";
    const cleanJson = extractJson(rawText);
    const jsonData = JSON.parse(cleanJson);

    // If AI still returns TBA for critical fields, it's considered a failed lookup
    if (!jsonData.origin || jsonData.origin === 'TBA' || !jsonData.destination || jsonData.destination === 'TBA') {
      console.warn(`Flight lookup for ${flightNo} returned incomplete data:`, jsonData);
      return null;
    }

    return {
      data: jsonData,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Gemini Flight Sync Error:", error);
    return null;
  }
};

export const extractEasyPassData = async (rawText: string, todayDate: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Today is ${todayDate}. 
      Parse arrivals from this raw text. Blocks are often separated by dashes or spaces.
      
      Example format to look for:
      Jan 24
      DMK / SL105
      23:00 PM / Arrival

      Rules:
      - date: STRICTLY follow the format "Month Day" (e.g., "Jan 24").
      - airport: The Thailand landing airport (e.g., DMK, BKK, CNX).
      - flightNo: The alphanumeric code (e.g., SL105). Normalize by removing spaces.
      - time: The arrival time (e.g., 23:00 PM).
      - paxCount: Extract number of passengers if mentioned (e.g., '4 PAX'). Default to 1.

      Text to parse:
      "${rawText}"

      Return a JSON array of objects with keys: date, airport, flightNo, time, visaType, departCountry, landedCountry, paxCount, remarks.`,
      config: {
        responseMimeType: "application/json",
      },
    });
    const rawOutput = response.text || "[]";
    const cleanJson = extractJson(rawOutput);
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("AI Manifest Extraction Error:", error);
    throw error;
  }
};
