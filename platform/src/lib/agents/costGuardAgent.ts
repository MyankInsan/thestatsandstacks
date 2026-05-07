import { BaseAgent } from './interfaces';

export interface CostGuardReport {
  zeroCostMode: boolean;
  isSafe: boolean;
  policy: string;
  failures: string[];
  notes: string[];
}

export class CostGuardAgent extends BaseAgent {
  constructor() {
    super('CostGuardAgent');
  }

  async execute(): Promise<CostGuardReport> {
    const zeroCostMode = process.env.ZERO_COST_MODE !== 'false';
    const failures: string[] = [];
    const notes: string[] = [];

    if (zeroCostMode) {
      if (process.env.ALLOW_PAID_IMAGE_GENERATION === 'true') {
        failures.push('ALLOW_PAID_IMAGE_GENERATION is true.');
      }
      if (process.env.FREE_IMAGE_GENERATION_ONLY === 'false') {
        failures.push('FREE_IMAGE_GENERATION_ONLY is false.');
      }
      if (process.env.OPENAI_VIDEO_API_KEY || process.env.SORA_API_KEY || process.env.RUNWAY_API_KEY) {
        failures.push('A paid video-generation API key appears to be configured.');
      }
      if (process.env.GEMINI_IMAGE_GENERATION_ENABLED === 'true') {
        failures.push('GEMINI_IMAGE_GENERATION_ENABLED is true; Gemini/Nano Banana image API usage can incur per-image charges.');
      }
      if (process.env.ALLOW_GEMINI_IMAGE_API_SPEND === 'true') {
        failures.push('ALLOW_GEMINI_IMAGE_API_SPEND is true.');
      }
    }

    notes.push('Image-only mode: the daily pipeline generates local Sharp PNG carousel slides and sends pictures only.');
    notes.push('Gemini/Nano Banana image generation is disabled in $0 mode; local Sharp generation remains the free path.');

    return {
      zeroCostMode,
      isSafe: failures.length === 0,
      policy: zeroCostMode
        ? '$0 image-only policy: local Sharp PNG slides, no paid image/video APIs.'
        : 'Zero-cost mode is disabled by env configuration.',
      failures,
      notes,
    };
  }
}
