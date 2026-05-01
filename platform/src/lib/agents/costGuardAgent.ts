import { BaseAgent } from './interfaces';
import { VideoGenerationAgent } from './videoGenerationAgent';

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
    }

    const videoMode = VideoGenerationAgent.getMode();
    notes.push(`Video mode: ${videoMode}.`);
    notes.push(VideoGenerationAgent.isAvailable()
      ? 'FFmpeg is available for free local video rendering.'
      : 'FFmpeg is not available; video rendering will be skipped safely.');

    return {
      zeroCostMode,
      isSafe: failures.length === 0,
      policy: zeroCostMode
        ? '$0 generation policy: local Sharp PNG slides, local FFmpeg MP4 videos, no paid image/video APIs.'
        : 'Zero-cost mode is disabled by env configuration.',
      failures,
      notes,
    };
  }
}
