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
// Raw AI descriptions: "Slide 3: What To Track: 5 Key Signals. | Revenue vs. Net Income. | (Visual: chart)"
// → strips prefix + visual notes → clean title + bullet array
// ---------------------------------------------------------------------------
function parseSlide(raw: string): { title: string; bullets: string[]; signalNum?: string } {
  const stripped = raw.replace(/^slide\s*\d+[:.]\s*/i, '').trim();
  const parts = stripped.split(/\s*\|\s*/);
  const content = parts
    .map(p => p.replace(/\.$/, '').trim())
    .filter(p => p.length > 0 && !/^\(visual:/i.test(p));
  const title = content[0] ?? stripped;
  const bullets = content.slice(1);

  // Detect "Key Signal N:" prefix in title
  const sigMatch = title.match(/key\s+signal\s+(\d+(?:\s*[&,]\s*\d+)?)[:.]/i);
  const signalNum = sigMatch?.[1];

  return { title, bullets, signalNum };
}

// Clean title: strip "Key Signal N:" prefix so it becomes just the topic
function cleanTitle(raw: string): string {
  return raw
    .replace(/^key\s+signal\s+\d+(?:\s*[&,]\s*\d+)?[:.]\s*/i, '')
    .replace(/^slide\s*\d+[:.]\s*/i, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Template routing — checks parsed title only, never raw description text
// ---------------------------------------------------------------------------
function resolveTemplate(strategy: StrategyDecision, slide: string, slideNumber: number): string {
  if (slideNumber === 1) return 'CoverSlide';

  const { title, bullets } = parseSlide(slide);
  const t = title.toLowerCase();
  const allText = (title + ' ' + bullets.join(' ')).toLowerCase();

  // Outro / CTA slides
  if (/\bfollow\b|save this|cta\b|outro\b|takeaway\b|subscribe\b/.test(t)) return 'OutroSlide';

  // Myth vs fact (title must contain myth/fact language)
  if (/\bmyth\b|misconception|the truth|the fact\b/.test(t)) return 'MythVsFactSlide';

  // True comparison: " vs " in the title (not just buried in bullets)
  if (/ vs\.? /.test(t) || /\bversus\b/.test(t)) return 'ComparisonSlide';

  // Risk slides
  if (/\brisk\b|red flag|warning|caution|watch out/.test(t)) return 'RiskMapSlide';

  // Big number: only when an actual numeric stat is in the title
  if (/\$\d|\d+%|\d+x\b|\d+\s*b(?:illion)?|\d+\s*t(?:rillion)?/.test(t)) return 'BigNumberSlide';

  // Market/ticker poster: only slide 2 for ticker-based topics
  if (slideNumber === 2 && /\b[A-Z]{2,5}\b/.test(strategy.topic)) return 'MarketPosterSlide';

  // Everything else — framework/checklist is the richest general template
  void allText;
  void strategy;
  return 'FrameworkSlide';
}

// ---------------------------------------------------------------------------
// Template prop builder — always uses parsed content, never raw strings
// ---------------------------------------------------------------------------
function buildTemplateProps(
  strategy: StrategyDecision,
  slide: string,
  slideNumber: number,
  template: string,
): Record<string, unknown> {
  const { title, bullets, signalNum } = parseSlide(slide);
  const topic = cleanTitle(title);
  const base = {
    frameNo: slideNumber,
    totalFrames: strategy.slideCount,
    tone: toneForSlide(slideNumber, strategy.slideCount),
  };

  // ── CoverSlide ────────────────────────────────────────────────────────────
  if (template === 'CoverSlide') {
    const hook = strategy.hook ?? topic;
    // Shorten kicker to first sentence or first bullet
    const kicker = (bullets[0] ?? '').replace(/\. .+$/, '') || 'Swipe for the breakdown.';
    return {
      ...base,
      tone: 'emerald',
      eyebrow: ((strategy as unknown as Record<string, unknown>).contentPillar?.toString().toUpperCase()) ?? 'MARKET EDUCATION',
      headline: hook.toUpperCase(),
      kicker,
    };
  }

  // ── MarketPosterSlide ─────────────────────────────────────────────────────
  if (template === 'MarketPosterSlide') {
    const tickerMatch = strategy.topic.match(/\b([A-Z]{2,5})\b/);
    return {
      ...base,
      tone: 'emerald',
      ticker: tickerMatch?.[1] ?? '—',
      name: strategy.topic,
      delta: '',
      headline: topic,
    };
  }

  // ── FrameworkSlide ────────────────────────────────────────────────────────
  if (template === 'FrameworkSlide') {
    const eyebrow = signalNum
      ? `KEY SIGNAL ${signalNum.replace(/\s/g, '')}`
      : eyebrowForTitle(title);
    const steps = buildSteps(bullets, topic, strategy.topic, signalNum);
    return {
      ...base,
      eyebrow,
      headline: topic,
      steps,
    };
  }

  // ── ComparisonSlide ───────────────────────────────────────────────────────
  if (template === 'ComparisonSlide') {
    const vsMatch = topic.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
    const leftLabel = (vsMatch?.[1]?.trim() ?? 'OPTION A').toUpperCase();
    const rightLabel = (vsMatch?.[2]?.trim() ?? 'OPTION B').toUpperCase();
    const half = Math.ceil(bullets.length / 2);
    return {
      ...base,
      tone: 'amber',
      eyebrow: 'COMPARISON',
      headline: topic,
      left: {
        label: leftLabel,
        bullets: bullets.slice(0, half).length
          ? bullets.slice(0, half)
          : comparisonBullets(leftLabel, strategy.topic, 'left'),
      },
      right: {
        label: rightLabel,
        bullets: bullets.slice(half).length
          ? bullets.slice(half)
          : comparisonBullets(rightLabel, strategy.topic, 'right'),
      },
    };
  }

  // ── MythVsFactSlide ───────────────────────────────────────────────────────
  if (template === 'MythVsFactSlide') {
    return {
      ...base,
      headline: topic,
      myth: bullets[0] ?? `Most people think ${topic.toLowerCase()} works differently`,
      fact: bullets[1] ?? `Here's what the data actually shows about ${strategy.topic}`,
    };
  }

  // ── BigNumberSlide ────────────────────────────────────────────────────────
  if (template === 'BigNumberSlide') {
    const statMatch = topic.match(/(\$[\d.]+[BMT]?|\d+[\d.]*%|\d+x)/i);
    return {
      ...base,
      eyebrow: 'THE NUMBER',
      value: statMatch?.[1] ?? '',
      context: topic.replace(statMatch?.[1] ?? '', '').trim() || strategy.topic,
      footnote: bullets[0],
    };
  }

  // ── RiskMapSlide ──────────────────────────────────────────────────────────
  if (template === 'RiskMapSlide') {
    const risks = bullets.slice(0, 3).map((b, i) => {
      const colonIdx = b.indexOf(':');
      return {
        tag: `RISK ${i + 1}`,
        title: colonIdx > 0 ? b.slice(0, colonIdx).trim() : b.split(' ').slice(0, 4).join(' '),
        body: colonIdx > 0 ? b.slice(colonIdx + 1).trim() : b,
      };
    });
    return {
      ...base,
      headline: topic,
      risks: risks.length >= 2 ? risks : defaultRisks(strategy.topic),
    };
  }

  // ── OutroSlide ────────────────────────────────────────────────────────────
  if (template === 'OutroSlide') {
    return {
      ...base,
      tone: 'cyan',
      headline: topic,
      cta: bullets[0] ?? 'Follow @TheStatsAndStacks for daily finance breakdowns',
    };
  }

  return { ...base, headline: topic };
}

// ---------------------------------------------------------------------------
// Step builder — generates 3 premium-feeling steps from bullets
// Labels are category tags ("KEY FACT", "WHY IT MATTERS", "YOUR MOVE")
// rather than redundant numbers
// ---------------------------------------------------------------------------
const STEP_LABELS: [string, string, string] = ['KEY FACT', 'WHY IT MATTERS', 'YOUR MOVE'];

const SIGNAL_LABELS: Record<string, [string, string, string]> = {
  default:  ['WHAT IT IS',     'WHY IT MATTERS',  'WHAT TO WATCH'],
  revenue:  ['THE METRIC',     'BEAT OR MISS',     'WHAT TO WATCH'],
  margin:   ['WHAT IT MEASURES','EFFICIENCY SIGNAL','WATCH FOR COMPRESSION'],
  guidance: ['WHAT IT COVERS', 'FORWARD SIGNAL',   'RED FLAGS'],
  inventory:['DEMAND SIGNAL',  'SUPPLY HEALTH',    'WATCH FOR EXCESS'],
  eps:      ['THE BOTTOM LINE','PROFITABILITY',    'COMPARE TO CONSENSUS'],
};

function buildSteps(
  bullets: string[],
  title: string,
  topic: string,
  signalNum?: string,
): Array<{ label: string; body: string }> {
  // Pick label set based on signal type or title keywords
  const t = title.toLowerCase();
  let labelSet: [string, string, string] = STEP_LABELS;
  if (signalNum) {
    if (/revenue|income|sales/.test(t))  labelSet = SIGNAL_LABELS.revenue;
    else if (/margin|gross/.test(t))     labelSet = SIGNAL_LABELS.margin;
    else if (/guidance|outlook/.test(t)) labelSet = SIGNAL_LABELS.guidance;
    else if (/inventory|supply/.test(t)) labelSet = SIGNAL_LABELS.inventory;
    else if (/eps|earnings per/.test(t)) labelSet = SIGNAL_LABELS.eps;
    else                                  labelSet = SIGNAL_LABELS.default;
  }

  const cleanBullet = (b: string) => b.replace(/\.$/, '').trim();

  // Build 3 steps — use real bullets where available, generate relevant fallbacks otherwise
  const step1: { label: string; body: string } = {
    label: labelSet[0],
    body: bullets[0] ? cleanBullet(bullets[0]) : genericBody(0, title, topic),
  };
  const step2: { label: string; body: string } = {
    label: labelSet[1],
    body: bullets[1] ? cleanBullet(bullets[1]) : genericBody(1, title, topic),
  };
  const step3: { label: string; body: string } = {
    label: labelSet[2],
    body: bullets[2] ? cleanBullet(bullets[2]) : genericBody(2, title, topic),
  };

  return [step1, step2, step3];
}

function genericBody(idx: number, title: string, topic: string): string {
  const t = title.toLowerCase();
  const tp = topic.split(' ').slice(0, 3).join(' ');
  if (idx === 0) return `One of the most important metrics for ${tp} investors to track`;
  if (idx === 1) return `Signals whether ${t} is trending in the right direction`;
  return `Compare quarter-over-quarter and against analyst consensus before acting`;
}

// ---------------------------------------------------------------------------
// Comparison column bullet fallbacks — topic-aware
// ---------------------------------------------------------------------------
function comparisonBullets(label: string, topic: string, side: 'left' | 'right'): string[] {
  const tp = topic.toLowerCase();
  if (/tfsa/.test(label.toLowerCase())) {
    return side === 'left'
      ? ['Tax-free growth on all gains', 'Flexible withdrawals anytime', 'No impact on income-tested benefits']
      : ['Tax deduction in contribution year', 'Grows fully tax-sheltered', 'Taxed as income on withdrawal'];
  }
  if (/rrsp/.test(label.toLowerCase())) {
    return side === 'left'
      ? ['Tax deduction reduces taxable income', 'Grows fully tax-sheltered', 'Best for higher income earners']
      : ['No deduction but tax-free withdrawals', 'Contribution room carries forward', 'Best for first-home or retirement goal'];
  }
  void tp;
  return [
    `Stronger when ${label.toLowerCase()} conditions apply`,
    'Assess your situation before choosing',
    'Consult a fee-only advisor for personal advice',
  ];
}

// ---------------------------------------------------------------------------
// Risk fallbacks
// ---------------------------------------------------------------------------
function defaultRisks(topic: string): Array<{ tag: string; title: string; body: string }> {
  return [
    { tag: 'RISK 1', title: 'Market volatility', body: `${topic.split(' ')[0]} can move sharply on earnings or macro data` },
    { tag: 'RISK 2', title: 'Overconcentration', body: 'Putting too much into one position amplifies downside' },
    { tag: 'RISK 3', title: 'Emotional decisions', body: 'Panic-selling during pullbacks locks in losses permanently' },
  ];
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------
const TONES = ['emerald', 'emerald', 'amber', 'rose', 'emerald', 'amber', 'cyan', 'cyan'] as const;

function toneForSlide(slideNumber: number, total: number): string {
  if (slideNumber === total) return 'cyan';
  return TONES[(slideNumber - 1) % TONES.length];
}

function eyebrowForTitle(title: string): string {
  const t = title.toLowerCase();
  if (/checklist|step|how to/.test(t)) return 'CHECKLIST';
  if (/signal|indicator/.test(t))      return 'KEY SIGNALS';
  if (/what to|guide|track/.test(t))   return 'YOUR GUIDE';
  if (/why |what |how /.test(t))       return 'EXPLAINER';
  if (/framework|filter/.test(t))      return 'FRAMEWORK';
  return 'BREAKDOWN';
}

// ---------------------------------------------------------------------------
// DALL-E / image prompt
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
    'Style: premium magazine infographic background, realistic paper/glass texture, subtle market-grid geometry, crisp lighting, high contrast, no clutter.',
    'Mobile readability: keep the center-left and lower third visually calm so exact text can be overlaid cleanly.',
    'Compliance: no fake price candles, no fake performance claims, no specific ticker recommendation visuals, no guaranteed-return symbolism.',
  ].join(' ');
}

function getVisualMode(format: StrategyDecision['format'], topic: string, slideNumber: number): string {
  const lower = topic.toLowerCase();
  if (/sandisk|sndk|nand|memory|semiconductor|data center/.test(lower)) {
    return slideNumber % 2 === 0
      ? 'AI infrastructure research desk with abstract storage-stack modules, NAND wafer geometry, catalyst cards'
      : 'premium semiconductor market terminal with abstract memory blocks, watchlist tiles, glowing data-center grid';
  }
  if (format === 'WATCHLIST_EDUCATION') {
    return slideNumber % 2 === 0
      ? 'analyst desk with abstract watchlist cards, risk gauge shapes, and layered market-screen depth'
      : 'premium research terminal mood with abstract company tiles, checklist geometry, and calm risk-map energy';
  }
  if (/nvda|nvidia|earnings|report/.test(lower)) {
    return 'premium financial research terminal, abstract candlestick chart shapes, dark data-panel depth, confident editorial mood';
  }
  if (lower.includes('credit')) return 'credit-report lab aesthetic with clean verification marks, document texture, myth/fact contrast';
  if (lower.includes('payday') || lower.includes('money')) return 'cash-flow operating system aesthetic with envelope layers, routing paths, automation cues';
  if (/tfsa|rrsp|fhsa/.test(lower)) return 'Canadian account map aesthetic with three abstract account vaults and decision-tree structure';
  if (lower.includes('tax')) return 'tax checklist desk aesthetic with organized document layers and understated calendar cues';
  return 'clean financial decision framework with layered data panels, soft depth, and modern editorial polish';
}
