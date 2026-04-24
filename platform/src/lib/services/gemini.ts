import { GoogleGenAI } from '@google/genai';

// Single shared Gemini client used by all agents
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in .env file. Get a free key at https://aistudio.google.com/apikey');
  }
  return new GoogleGenAI({ apiKey });
}
