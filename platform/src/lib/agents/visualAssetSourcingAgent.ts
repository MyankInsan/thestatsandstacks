import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';
import { ImagePromptSet } from './imagePromptAgent';
import { CarouselPlan, MediaFormatDecision } from './mediaPlanningAgent';

export type VisualAssetProvider = 'cloudflare' | 'pexels' | 'wikimedia' | 'local';

export interface VisualAssetSlidePlan {
  slideNumber: number;
  provider: VisualAssetProvider;
  query: string;
  backgroundPrompt: string;
  reason: string;
  assetUrl?: string;
  sourcePage?: string;
  attribution?: string;
  license?: string;
  warnings?: string[];
}

export interface VisualAssetSourcingPlan {
  summary: string;
  providerOrder: VisualAssetProvider[];
  slides: VisualAssetSlidePlan[];
  warnings: string[];
}

interface PexelsPhoto {
  url?: string;
  photographer?: string;
  photographer_url?: string;
  src?: {
    original?: string;
    large2x?: string;
    large?: string;
    portrait?: string;
  };
}

interface WikimediaPage {
  title?: string;
  imageinfo?: Array<{
    url?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

const ASSET_FETCH_TIMEOUT_MS = 8_000;

export class VisualAssetSourcingAgent extends BaseAgent {
  constructor() {
    super('VisualAssetSourcingAgent');
  }

  async execute(input: {
    strategy: StrategyDecision,
    prompts: ImagePromptSet['prompts'],
    formatDecision?: MediaFormatDecision,
    carouselPlan?: CarouselPlan,
  }): Promise<VisualAssetSourcingPlan> {
    console.log(`[${this.name}] 🔎 Choosing legal zero-cost visual sources...`);
    const providerOrder = getProviderOrder();
    const warnings: string[] = [];
    const slides: VisualAssetSlidePlan[] = [];

    for (const prompt of input.prompts) {
      const query = buildVisualSearchQuery(input.strategy, prompt.slideDescription, prompt.slideNumber);
      const backgroundPrompt = buildBackgroundPrompt(input.strategy, prompt.slideDescription, input.carouselPlan);
      const slidePlan = await this.resolveSlidePlan({
        providerOrder,
        strategy: input.strategy,
        slideNumber: prompt.slideNumber,
        slideDescription: prompt.slideDescription,
        query,
        backgroundPrompt,
      });
      slides.push(slidePlan);
      if (slidePlan.warnings?.length) warnings.push(...slidePlan.warnings);
    }

    const activeProviders = Array.from(new Set(slides.map((slide) => slide.provider)));
    return {
      summary: `Visual desk selected ${activeProviders.join(', ')} for ${slides.length} picture slide${slides.length === 1 ? '' : 's'}. Google Images/Photos are intentionally excluded for rights and OAuth reasons.`,
      providerOrder,
      slides,
      warnings,
    };
  }

  private async resolveSlidePlan(input: {
    providerOrder: VisualAssetProvider[],
    strategy: StrategyDecision,
    slideNumber: number,
    slideDescription: string,
    query: string,
    backgroundPrompt: string,
  }): Promise<VisualAssetSlidePlan> {
    for (const provider of input.providerOrder) {
      if (provider === 'cloudflare') {
        return {
          slideNumber: input.slideNumber,
          provider,
          query: input.query,
          backgroundPrompt: input.backgroundPrompt,
          reason: 'Cloudflare Workers AI can create original photo-style finance backgrounds without copying third-party images.',
        };
      }

      if (provider === 'pexels') {
        const pexels = await fetchPexelsImage(input.query);
        if (pexels) {
          return {
            slideNumber: input.slideNumber,
            provider,
            query: input.query,
            backgroundPrompt: input.backgroundPrompt,
            reason: 'Pexels returned a free licensed stock photo suitable for an original editorial composite.',
            assetUrl: pexels.assetUrl,
            sourcePage: pexels.sourcePage,
            attribution: pexels.attribution,
            license: 'Pexels License',
          };
        }
      }

      if (provider === 'wikimedia') {
        const commons = await fetchWikimediaImage(input.query);
        if (commons) {
          return {
            slideNumber: input.slideNumber,
            provider,
            query: input.query,
            backgroundPrompt: input.backgroundPrompt,
            reason: 'Wikimedia Commons returned a reusable public-license image with attribution metadata.',
            assetUrl: commons.assetUrl,
            sourcePage: commons.sourcePage,
            attribution: commons.attribution,
            license: commons.license,
          };
        }
      }
    }

    return {
      slideNumber: input.slideNumber,
      provider: 'local',
      query: input.query,
      backgroundPrompt: input.backgroundPrompt,
      reason: 'No external free/legal provider was configured or available, so the guaranteed local renderer will create the post.',
      warnings: ['Using local synthetic visuals. Add Cloudflare or Pexels secrets for more photo-real premium backgrounds.'],
    };
  }
}

function getProviderOrder(): VisualAssetProvider[] {
  const order: VisualAssetProvider[] = [];
  const licensedEnabled = process.env.ENABLE_LICENSED_ASSET_SOURCING === 'true';
  const preferStock = process.env.PREFER_STOCK_ASSET_SOURCING === 'true';
  const cloudflareReady = process.env.CLOUDFLARE_WORKERS_AI_ENABLED === 'true'
    && Boolean(process.env.CLOUDFLARE_ACCOUNT_ID)
    && Boolean(process.env.CLOUDFLARE_API_TOKEN);
  const pexelsReady = licensedEnabled && Boolean(process.env.PEXELS_API_KEY);
  const wikimediaReady = licensedEnabled && process.env.ENABLE_WIKIMEDIA_SOURCING === 'true';

  if (preferStock && pexelsReady) order.push('pexels');
  if (cloudflareReady) order.push('cloudflare');
  if (!preferStock && pexelsReady) order.push('pexels');
  if (wikimediaReady) order.push('wikimedia');
  order.push('local');

  return Array.from(new Set(order));
}

function buildVisualSearchQuery(strategy: StrategyDecision, slideDescription: string, slideNumber: number): string {
  const text = `${strategy.topic} ${slideDescription}`.toLowerCase();
  if (/sandisk|sndk|semiconductor|storage|memory|data center|datacenter|nand|ai/.test(text)) {
    return slideNumber === 1
      ? 'semiconductor data center servers storage technology'
      : 'computer chip data center finance technology';
  }
  if (/stock|market|watchlist|earnings|valuation|portfolio|ticker/.test(text)) {
    return 'stock market trading desk financial charts';
  }
  if (/cash|payday|budget|debt|saving|money leak/.test(text)) {
    return 'personal finance budget desk money planning';
  }
  if (/tax|rrsp|tfsa|fhsa|account|credit/.test(text)) {
    return 'finance documents desk planning calculator';
  }
  return 'premium finance desk investing planning';
}

function buildBackgroundPrompt(
  strategy: StrategyDecision,
  slideDescription: string,
  carouselPlan?: CarouselPlan
): string {
  return [
    `Topic: ${strategy.topic}.`,
    `Slide: ${slideDescription}.`,
    `Composition: ${carouselPlan?.density === 'premium-poster' ? 'viral finance poster with strong upper-half focal object and dark lower text zone' : 'premium editorial carousel background with structured density'}.`,
    'No readable text, no fake numbers, no logos, no brokerage screenshots, no buy/sell implication.',
  ].join(' ');
}

async function fetchPexelsImage(query: string): Promise<{
  assetUrl: string;
  sourcePage?: string;
  attribution?: string;
} | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;
  const params = new URLSearchParams({
    query,
    orientation: 'portrait',
    per_page: '8',
  });

  try {
    const response = await fetchWithTimeout(`https://api.pexels.com/v1/search?${params.toString()}`, {
      headers: { Authorization: apiKey },
    });
    if (!response.ok) return null;
    const payload = await response.json() as { photos?: PexelsPhoto[] };
    const photo = (payload.photos || []).find((candidate) => candidate.src?.large2x || candidate.src?.large || candidate.src?.original);
    if (!photo?.src) return null;
    return {
      assetUrl: photo.src.large2x || photo.src.large || photo.src.original || '',
      sourcePage: photo.url,
      attribution: photo.photographer
        ? `Photo by ${photo.photographer} on Pexels${photo.photographer_url ? ` (${photo.photographer_url})` : ''}`
        : 'Photo from Pexels',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[VisualAssetSourcingAgent] Pexels lookup failed: ${message}`);
    return null;
  }
}

async function fetchWikimediaImage(query: string): Promise<{
  assetUrl: string;
  sourcePage?: string;
  attribution?: string;
  license?: string;
} | null> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    format: 'json',
    origin: '*',
  });

  try {
    const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: {
        'User-Agent': process.env.WIKIMEDIA_USER_AGENT || 'thestatsandstacks-content-bot/1.0',
      },
    });
    if (!response.ok) return null;
    const payload = await response.json() as { query?: { pages?: Record<string, WikimediaPage> } };
    const pages = Object.values(payload.query?.pages || {});
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata || {};
      const license = stripHtml(meta.LicenseShortName?.value || meta.License?.value || '');
      const mime = stripHtml(meta.MIMEType?.value || '');
      if (!info?.url || !isReusableLicense(license) || (mime && !mime.startsWith('image/'))) continue;
      const author = stripHtml(meta.Artist?.value || meta.Credit?.value || 'Wikimedia Commons contributor');
      return {
        assetUrl: info.url,
        sourcePage: info.descriptionurl,
        attribution: `${author} via Wikimedia Commons`,
        license,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[VisualAssetSourcingAgent] Wikimedia lookup failed: ${message}`);
  }

  return null;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSET_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isReusableLicense(value: string): boolean {
  return /\b(public domain|cc0|cc by(?:\s|$)|creative commons attribution)\b/i.test(value)
    && !/\bcc by-sa\b/i.test(value);
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
