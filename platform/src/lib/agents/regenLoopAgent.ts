// platform/src/lib/agents/regenLoopAgent.ts
import { BaseAgent } from './interfaces';
import type { GeneratedImage } from './imageGenerationAgent';

export interface CritiqueResult {
  score: number;
  pass: boolean;
  issues: Array<{ severity: 'high' | 'medium' | 'low'; body: string }>;
  layoutSuggestion?: string;
}

export interface RegenLoopInput {
  slideNumber: number;
  prompt: {
    slideNumber: number;
    slideDescription: string;
    dallePrompt: string;
    template: string;
    templateProps: Record<string, unknown>;
  };
  generate: (prompt: RegenLoopInput['prompt'], correctionNotes: string) => Promise<GeneratedImage>;
  critique: (image: GeneratedImage) => Promise<CritiqueResult>;
}

export interface RegenLoopResult {
  image: GeneratedImage;
  attempts: number;
  resolved: boolean;
  finalScore: number;
  critiqueHistory: CritiqueResult[];
}

const MAX_ATTEMPTS = 5;

export class RegenLoopAgent extends BaseAgent {
  constructor() {
    super('RegenLoopAgent');
  }

  async execute(input: RegenLoopInput): Promise<RegenLoopResult> {
    const history: CritiqueResult[] = [];
    let correctionNotes = '';
    let bestImage: GeneratedImage | null = null;
    let bestScore = -1;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const image = await input.generate(input.prompt, correctionNotes);
      const critique = await input.critique(image);
      history.push(critique);

      if (critique.score > bestScore) { bestScore = critique.score; bestImage = image; }

      if (critique.pass) {
        console.log(`[${this.name}] Slide ${input.slideNumber} passed on attempt ${attempt} (score ${(critique.score * 100).toFixed(0)}%).`);
        return { image: bestImage!, attempts: attempt, resolved: true, finalScore: critique.score, critiqueHistory: history };
      }

      correctionNotes = critique.issues.filter((i) => i.severity === 'high').map((i) => i.body).join('. ') || critique.issues.map((i) => i.body).join('. ');
      if (critique.layoutSuggestion) correctionNotes += ` Layout fix: ${critique.layoutSuggestion}`;
      console.warn(`[${this.name}] Attempt ${attempt}/${MAX_ATTEMPTS} slide ${input.slideNumber} failed (score ${(critique.score * 100).toFixed(0)}%). Issues: ${correctionNotes}`);
    }

    console.warn(`[${this.name}] Slide ${input.slideNumber} unresolved after ${MAX_ATTEMPTS} attempts. Using best result (score ${(bestScore * 100).toFixed(0)}%).`);
    return { image: bestImage!, attempts: MAX_ATTEMPTS, resolved: false, finalScore: bestScore, critiqueHistory: history };
  }
}
