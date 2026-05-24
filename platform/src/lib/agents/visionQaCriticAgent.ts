export interface VisionQARequest {
  imageUrl: string;
  expectedText: string[];
  brandVibe: string;
}

export interface VisionQAResponse {
  passed: boolean;
  score: number; // 0-100
  critique: string;
  hallucinationsDetected: boolean;
  brandAlignment: string;
}

// A mock implementation of the VLM API call (e.g., GPT-4o Vision or Gemini Pro Vision)
async function callVisionLanguageModel(imageUrl: string, prompt: string): Promise<string> {
  void imageUrl; // satisfy linter
  void prompt; // satisfy linter
  // In a real implementation, this would send the image URL and prompt to the VLM API.
  // We mock the response here for the sake of the architecture skeleton.
  return JSON.stringify({
    passed: true,
    score: 95,
    critique: "The image perfectly matches the requested lighting, minimal aesthetic, and the text is rendered flawlessly without typos.",
    hallucinationsDetected: false,
    brandAlignment: "Strongly aligned with the premium, non-hype financial aesthetic."
  });
}

export class VisionQaCriticAgent {
  async evaluateImage(request: VisionQARequest): Promise<VisionQAResponse> {
    const prompt = `
      You are an elite, highly critical Vision QA Editor for a multi-million follower premium finance brand.
      
      Review the provided image against these strict heuristics:
      1. TEXT ACCURACY: The image must contain exactly these strings: ${JSON.stringify(request.expectedText)}. 
         Are there any typos, garbled letters, or hallucinated text?
      2. BRAND VIBE: The image must align with this vibe: "${request.brandVibe}".
      3. ANTI-HYPE: The image must NOT contain any "finance bro" clichés (e.g., 3D gold coins, neon green arrows, literal bull/bear, chaotic glowing text).
      4. QUALITY: The lighting must be premium, high-contrast, and editorial. No blurry or pixelated areas.

      Return a JSON object with:
      - passed (boolean)
      - score (number 0-100)
      - critique (string - detailed feedback on what needs fixing if it failed)
      - hallucinationsDetected (boolean - true if the text is misspelled or extra text is present)
      - brandAlignment (string - how well it matches the aesthetic)
    `;

    try {
      const vlmResponse = await callVisionLanguageModel(request.imageUrl, prompt);
      const parsed = JSON.parse(vlmResponse);
      
      // Strict threshold
      if (parsed.hallucinationsDetected || parsed.score < 80) {
        parsed.passed = false;
      }
      
      return parsed as VisionQAResponse;
    } catch (error) {
      console.error("VLM evaluation failed", error);
      return {
        passed: false,
        score: 0,
        critique: "VLM parsing error or API failure.",
        hallucinationsDetected: true,
        brandAlignment: "Unknown"
      };
    }
  }
}
