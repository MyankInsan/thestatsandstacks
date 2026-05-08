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
      if (process.env.GOOGLE_IMAGE_SCRAPING_ENABLED === 'true' || process.env.GOOGLE_PHOTOS_SOURCING_ENABLED === 'true') {
        failures.push('Google Images/Photos sourcing is enabled; this pipeline only permits original generation or reusable/licensed asset APIs.');
      }
      if (process.env.CLOUDFLARE_WORKERS_AI_ENABLED === 'true') {
        const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
        const maxImages = Number.parseInt(process.env.CLOUDFLARE_MAX_IMAGES_PER_RUN || '8', 10);
        if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
          failures.push('CLOUDFLARE_WORKERS_AI_ENABLED is true, but CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing.');
        }
        if (model !== '@cf/black-forest-labs/flux-1-schnell') {
          failures.push('CLOUDFLARE_IMAGE_MODEL must stay @cf/black-forest-labs/flux-1-schnell in zero-cost mode.');
        }
        if (Number.isFinite(maxImages) && maxImages > 8) {
          failures.push('CLOUDFLARE_MAX_IMAGES_PER_RUN must stay at 8 or lower in zero-cost mode.');
        }
        if (process.env.CLOUDFLARE_ALLOW_PAID_OVERAGE === 'true') {
          failures.push('CLOUDFLARE_ALLOW_PAID_OVERAGE is true.');
        }
      }
    }

    notes.push('Image-only mode: the daily pipeline generates PNG carousel slides and sends pictures only.');
    notes.push('Gemini/Nano Banana image generation is disabled in $0 mode; local Sharp generation remains the fallback path.');
    notes.push('Optional Cloudflare Workers AI backgrounds are allowed only with the low-cost/free-allocation Flux Schnell model and a hard per-run cap.');
    notes.push('Optional Pexels/Wikimedia sourcing is allowed only as free licensed asset sourcing with source/attribution notes.');

    return {
      zeroCostMode,
      isSafe: failures.length === 0,
      policy: zeroCostMode
        ? '$0 image-only policy: local Sharp PNG slides or capped Cloudflare free-allocation backgrounds, no paid image/video APIs.'
        : 'Zero-cost mode is disabled by env configuration.',
      failures,
      notes,
    };
  }
}
