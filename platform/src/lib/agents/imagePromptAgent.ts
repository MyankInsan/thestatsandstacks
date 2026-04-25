import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';

export interface ImagePromptSet {
  prompts: Array<{
    slideNumber: number;
    slideDescription: string;
    dallePrompt: string;
  }>;
}

export class ImagePromptAgent extends BaseAgent {
  constructor() {
    super('ImagePromptAgent');
  }

  async execute(input: { strategy: StrategyDecision }): Promise<ImagePromptSet> {
    console.log(`[${this.name}] 🎨 Generating image prompts...`);

    return {
      prompts: input.strategy.slideBreakdown.map((slide, index) => ({
        slideNumber: index + 1,
        slideDescription: slide,
        dallePrompt: `Premium Instagram finance carousel slide for TheStatsAndStacks. ${slide}. Dark navy and charcoal background, emerald and muted gold accents, clean editorial layout, clear typography zones, data-first Canadian personal finance visual style.`,
      })),
    };
  }
}
