import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';

export interface SlidePrompt {
  slideNumber: number;
  slideDescription: string;
  dallePrompt: string;
  template: string;
  templateProps: Record<string, unknown>;
}

export interface ImagePromptSet {
  prompts: SlidePrompt[];
}

export class ImagePromptAgent extends BaseAgent {
  constructor() {
    super('ImagePromptAgent');
  }

  async execute(input: { strategy: StrategyDecision }): Promise<ImagePromptSet> {
    console.log(`[${this.name}] 🎨 Generating image prompts...`);

    return {
      prompts: input.strategy.slideBreakdown.map((slide, index) => {
        const slideNumber = index + 1;
        const template = resolveTemplate(input.strategy, slide, slideNumber);
        return {
          slideNumber,
          slideDescription: slide,
          dallePrompt: buildPremiumImagePrompt(input.strategy, slide, slideNumber),
          template,
          templateProps: buildTemplateProps(input.strategy, slide, slideNumber, template),
        };
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// Slide description parser
// Raw AI descriptions look like:
//   "Slide 3: What To Track: 5 Key Signals. | Revenue vs. Net Income. | (Visual: chart)"
// We strip the prefix, split on " | ", drop visual-direction notes, and return
// a clean title + array of content bullets.
// ---------------------------------------------------------------------------
function parseSlide(raw: string): { title: string; bullets: string[] } {
  const stripped = raw.replace(/^slide\s*\d+[:.]\s*/i, '');
  const parts = stripped.split(/\s*\|\s*/);
  const content = parts
    .map(p => p.replace(/\.$/, '').trim())
    .filter(p => p.length > 0 && !/^\(visual:/i.test(p));
  const title = content[0] ?? stripped;
  const bullets = content.slice(1);
  return { title, bullets };
}

// ---------------------------------------------------------------------------
// Template routing — checks parsed title only, not the full raw description,
// so a bullet mentioning "vs." doesn't hijack the whole slide template.
// ---------------------------------------------------------------------------
function resolveTemplate(strategy: StrategyDecision, slide: string, slideNumber: number): string {
  if (slideNumber === 1) return 'CoverSlide';

  const { title, bullets } = parseSlide(slide);
  const t = title.toLowerCase();
  const allText = (title + ' ' + bullets.join(' ')).toLowerCase();

  // Market/ticker poster: only when the title is about a specific ticker or market event
  const tickerInTopic = /\b[A-Z]{2,5}\b/.test(strategy.topic);
  if (tickerInTopic && slideNumber === 2) return 'MarketPosterSlide';

  // Outro: follow / save / cta in title
  if (/follow|save this|cta|outro|takeaway|subscribe/.test(t)) return 'OutroSlide';

  // Myth vs fact: must be in title
  if (/myth|misconception|truth|fact/.test(t)) return 'MythVsFactSlide';

  // Comparison: " vs " must appear in the title, not just in a bullet
  if (/ vs\.? /.test(t) || /compare.*vs|versus/.test(t)) return 'ComparisonSlide';

  // Risk: risk/warning in title
  if (/\brisk\b|warning|caution|watch out/.test(t)) return 'RiskMapSlide';

  // Big number: only when an actual numeric stat appears in the title
  if (/\$\d|\d+%|\d+x\b|\d+\s*billion|\d+\s*trillion/.test(t)) return 'BigNumberSlide';

  // Framework / checklist: structured step-by-step content
  // (This is the best default for educational slides with bullet content)
  if (/framework|checklist|filter|step|how to|key signal|what to|guide|signal \d/.test(allText)) return 'FrameworkSlide';

  void strategy;
  return 'FrameworkSlide';
}

// ---------------------------------------------------------------------------
// Template prop builder — always uses parsed title/bullets, never the raw string
// ---------------------------------------------------------------------------
function buildTemplateProps(
  strategy: StrategyDecision,
  slide: string,
  slideNumber: number,
  template: string,
): Record<string, unknown> {
  const { title, bullets } = parseSlide(slide);
  const base = {
    frameNo: slideNumber,
    totalFrames: strategy.slideCount,
    tone: toneForSlide(slideNumber, strategy.slideCount),
  };

  if (template === 'CoverSlide') {
    return {
      ...base,
      tone: 'emerald',
      eyebrow: ((strategy as unknown as Record<string, unknown>).contentPillar?.toString().toUpperCase()) ?? 'MARKET EDUCATION',
      headline: strategy.hook.toUpperCase(),
      kicker: bullets[0] ?? title,
    };
  }

  if (template === 'MarketPosterSlide') {
    const tickerMatch = strategy.topic.match(/\b([A-Z]{2,5})\b/);
    return {
      ...base,
      tone: 'emerald',
      ticker: tickerMatch?.[1] ?? '—',
      name: strategy.topic,
      delta: '',
      headline: title,
    };
  }

  if (template === 'FrameworkSlide') {
    const steps = bulletsToSteps(bullets, title, strategy.topic);
    return {
      ...base,
      eyebrow: eyebrowForTitle(title),
      headline: title,
      steps,
    };
  }

  if (template === 'ComparisonSlide') {
    const vsMatch = title.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
    const leftLabel = vsMatch?.[1]?.trim().toUpperCase() ?? 'OPTION A';
    const rightLabel = vsMatch?.[2]?.trim().toUpperCase() ?? 'OPTION B';
    // Split bullets evenly between columns, or use topic-specific fallback
    const half = Math.ceil(bullets.length / 2);
    const leftBullets = bullets.slice(0, half).length > 0
      ? bullets.slice(0, half)
      : topicBullets(leftLabel, strategy.topic);
    const rightBullets = bullets.slice(half).length > 0
      ? bullets.slice(half)
      : topicBullets(rightLabel, strategy.topic);
    return {
      ...base,
      tone: 'amber',
      eyebrow: 'COMPARISON',
      headline: title,
      left: { label: leftLabel, bullets: leftBullets },
      right: { label: rightLabel, bullets: rightBullets },
    };
  }

  if (template === 'MythVsFactSlide') {
    return {
      ...base,
      headline: title,
      myth: bullets[0] ?? 'Common misconception about ' + strategy.topic,
      fact: bullets[1] ?? 'The evidence-based reality for Canadian investors',
    };
  }

  if (template === 'BigNumberSlide') {
    const statMatch = title.match(/(\$[\d.]+[BMT]?|\d+[\d.]*%|\d+x)/i);
    return {
      ...base,
      eyebrow: 'THE NUMBER',
      value: statMatch?.[1] ?? '',
      context: title,
      footnote: bullets[0],
    };
  }

  if (template === 'RiskMapSlide') {
    const risks = bullets.slice(0, 3).map((b, i) => ({
      tag: `RISK ${i + 1}`,
      title: b.split(':')[0]?.trim() ?? b,
      body: b.split(':').slice(1).join(':').trim() || b,
    }));
    const fallbackRisks = [
      { tag: 'RISK 1', title: 'Market volatility', body: 'Prices can move sharply in either direction.' },
      { tag: 'RISK 2', title: 'Liquidity risk', body: 'Some assets are harder to exit quickly.' },
      { tag: 'RISK 3', title: 'Emotional decisions', body: 'Panic-selling locks in losses unnecessarily.' },
    ];
    return {
      ...base,
      headline: title,
      risks: risks.length >= 2 ? risks : fallbackRisks,
    };
  }

  if (template === 'OutroSlide') {
    return {
      ...base,
      tone: 'cyan',
      headline: title,
      cta: bullets[0] ?? 'Follow @TheStatsAndStacks for daily finance breakdowns',
    };
  }

  // Fallback — should never be reached, but safe to have
  return { ...base, headline: title };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toneForSlide(slideNumber: number, total: number): string {
  if (slideNumber === total) return 'cyan';
  const cycle = ['emerald', 'amber', 'emerald', 'rose', 'emerald', 'amber', 'emerald', 'cyan'];
  return cycle[(slideNumber - 1) % cycle.length];
}

function eyebrowForTitle(title: string): string {
  const t = title.toLowerCase();
  if (/checklist|step|how to/.test(t)) return 'CHECKLIST';
  if (/signal|key|indicator/.test(t)) return 'KEY SIGNALS';
  if (/guide|what to|track/.test(t)) return 'YOUR GUIDE';
  if (/why|what|how/.test(t)) return 'EXPLAINER';
  return 'DECISION FILTER';
}

function bulletsToSteps(bullets: string[], title: string, topic: string): Array<{ label: string; body: string }> {
  if (bullets.length > 0) {
    return bullets.slice(0, 3).map((b, i) => ({
      label: `0${i + 1}`,
      body: b,
    }));
  }
  // Generic fallback steps derived from topic when no bullets available
  return [
    { label: '01', body: `Understand the fundamentals of ${topic}` },
    { label: '02', body: title },
    { label: '03', body: 'Apply this framework before your next move' },
  ];
}

function topicBullets(side: string, topic: string): string[] {
  void side;
  return [
    `Key factor in ${topic}`,
    'Assess before deciding',
    'Understand the trade-offs',
  ];
}

// ---------------------------------------------------------------------------
// DALL-E / image prompt (unchanged from original)
// ---------------------------------------------------------------------------
function buildPremiumImagePrompt(strategy: StrategyDecision, slide: string, slideNumber: number): string {
  const isCover = slideNumber === 1;
  const visualMode = getVisualMode(strategy.format, strategy.topic, slideNumber);

  return [
    'Create a premium editorial finance background for an Instagram portrait carousel slide.',
    'IMPORTANT: no words, no letters, no numbers, no logos, no charts with readable labels. Leave all typography to a later overlay.',
    `Brand: TheStatsAndStacks, high-trust Canadian finance, data-first, calm and sophisticated.`,
    `Topic: ${strategy.topic}. Slide intent: ${slide}.`,
    `Composition: ${isCover ? 'strong cover-worthy focal point with structured visual density and no dead zones' : 'supporting visual with clear open zones for headline and bullet overlays, balanced density, and no empty-looking corners'}.`,
    `Visual direction: ${visualMode}.`,
    'Reference mood: high-performing finance creator content that is simple, original, and saveable, but do not copy any creator layout, brand, screenshot, or post.',
    'Palette: deep charcoal, graphite, emerald accents, muted gold highlights, confident off-white contrast, occasional cool cyan or violet only as secondary contrast.',
    'Style: premium magazine infographic background, realistic paper/glass texture, subtle market-grid geometry, crisp lighting, high contrast, no clutter, no meme style, no generic corporate stock-photo feel.',
    'Mobile readability: keep the center-left and lower third visually calm so exact text can be overlaid cleanly.',
    'Compliance: no fake price candles, no fake performance claims, no specific ticker recommendation visuals, no guaranteed-return symbolism.',
  ].join(' ');
}

function getVisualMode(format: StrategyDecision['format'], topic: string, slideNumber: number): string {
  const lower = topic.toLowerCase();
  if (/sandisk|sndk|ai storage|nand|memory|semiconductor|data center|datacenter/.test(lower)) {
    return slideNumber % 2 === 0
      ? 'AI infrastructure research desk with abstract storage-stack modules, NAND wafer geometry, catalyst cards, and risk-meter depth'
      : 'premium semiconductor market terminal with abstract memory blocks, watchlist tiles, glowing data-center grid, and disciplined risk-map energy';
  }
  if (format === 'WATCHLIST_EDUCATION') {
    return slideNumber % 2 === 0
      ? 'analyst desk with abstract watchlist cards, risk gauge shapes, and layered market-screen depth'
      : 'premium research terminal mood with abstract company tiles, checklist geometry, and calm risk-map energy';
  }
  if (lower.includes('credit')) {
    return 'credit-report lab aesthetic with clean verification marks, document texture, and myth/fact contrast';
  }
  if (lower.includes('payday') || lower.includes('money leak')) {
    return 'cash-flow operating system aesthetic with envelope layers, routing paths, and subtle automation cues';
  }
  if (lower.includes('tfsa') || lower.includes('rrsp') || lower.includes('fhsa')) {
    return 'Canadian account map aesthetic with three abstract account vaults and decision-tree structure';
  }
  if (lower.includes('tax')) {
    return 'tax checklist desk aesthetic with organized document layers and understated calendar cues';
  }
  return 'clean financial decision framework with layered data panels, soft depth, and modern editorial polish';
}
