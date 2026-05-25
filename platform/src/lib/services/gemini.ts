import { GoogleGenerativeAI } from '@google/generative-ai';

// Single shared Gemini client used by all agents
export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it to GitHub Actions secrets or platform/.env.');
  }
  return new GoogleGenerativeAI(apiKey);
}

export function getGeminiTextModelName(): string {
  return process.env.GEMINI_TEXT_MODEL || 'gemini-flash-latest';
}
