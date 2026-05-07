import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';

export interface CopyBundle {
  caption: string;
  hashtags: string;
  cta: string;
  firstComment: string;
  altText: string;
}

const MAX_CAPTION_CHARS = 1100;
const MAX_HASHTAGS = 5;
const MAX_FIRST_COMMENT_CHARS = 220;
const BRAND_FOLLOW_NAME = 'TheStatsAndStacks';

export class CopywritingAgent extends BaseAgent {
  constructor() {
    super('CopywritingAgent');
  }

  async execute(input: { strategy: StrategyDecision }): Promise<CopyBundle> {
    console.log(`[${this.name}] ✍️  Writing copy...`);

    const prompt = `Write Instagram copy for "TheStatsAndStacks".
    
Topic: ${input.strategy.topic}
Slide breakdown:
${input.strategy.slideBreakdown.join('\n')}

Rules:
- If the topic mentions stocks, do not recommend buy/sell/hold.
- Do not use price targets, guaranteed returns, or personalized investment advice.
- Do not invent exact returns, dates, earnings numbers, ticker status, acquisitions, or "inactive ticker" claims.
- Do not change a performance window. If a slide says YTD, 1Y, or from 52-week low, never call it "today" or "1 day."
- Avoid hype verbs like explodes, moons, blasts off, skyrockets, and can't miss. Sound premium and calm.
- Use "educational only, not financial advice" language.
- Write for saves, shares, and follows: clear first line, useful framework, no cheap engagement bait.
- Caption structure: one sharp first line, then 2-4 short paragraphs or tight lines. Make it skim-friendly on mobile.
- Include a concrete follow reason once, e.g. daily Canadian money frameworks, calm investing education, or no-hype finance systems.
- Caption must be under ${MAX_CAPTION_CHARS} characters. The first line must work before Instagram's "more" truncation.
- Use 3-5 focused hashtags, never more than ${MAX_HASHTAGS}.
- Naturally include search terms from: ${input.strategy.searchKeywords.join(', ')}
- Mention only the ticker/company in the topic. Do not mention unrelated tickers just because they appear in search keywords.
- Do not wrap keywords in backticks, quotes, or SEO-looking formatting.
- Vary the CTA. Prefer a save/share prompt plus a reason to follow only when it fits the post.
- First comment should ask one specific useful question that invites thoughtful replies without begging for engagement.
- Do not put hashtags inside the caption body; return them only in the hashtags field.

Output ONLY valid JSON:
{
  "caption": "string",
  "hashtags": "string",
  "cta": "string",
  "firstComment": "string",
  "altText": "string"
}`;

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const text = (await result.response).text().trim();

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return normalizeCopyBundle(JSON.parse(cleaned) as CopyBundle, input.strategy);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.name}] Gemini copywriting failed; using fallback copy. ${message}`);
      const isStockEducation = isStockEducationTopic(input.strategy);
      return normalizeCopyBundle({
        caption: `${input.strategy.topic}\n\nUse this as a research framework, not a shortcut.\n\nThe goal is not to chase a headline. The goal is to ask better questions before money is at risk.\n\nEducational general information only, not personalized financial advice.`,
        hashtags: isStockEducation
          ? '#CanadianFinance #InvestingCanada #StockMarketEducation #RiskManagement #PersonalFinanceCanada'
          : '#CanadianFinance #PersonalFinanceCanada #MoneyTips #InvestingCanada #FinancialLiteracy',
        cta: isStockEducation ? 'Save this before researching your next ticker.' : 'Save this before your next money decision.',
        firstComment: isStockEducation
          ? 'What do you check first: business quality, valuation, or risk?'
          : 'Which account are you comparing right now: TFSA, RRSP, or FHSA?',
        altText: `TheStatsAndStacks carousel about ${input.strategy.topic}.`,
      }, input.strategy);
    }
  }
}

export function normalizeCopyBundle(bundle: CopyBundle, strategy: StrategyDecision): CopyBundle {
  const cta = buildGrowthCta(bundle.cta || fallbackCta(strategy), strategy);
  const isStockEducation = isStockEducationTopic(strategy);

  let caption = cleanCopyArtifacts(stripHashtags(bundle.caption || '')).trim();
  if (!caption) caption = strategy.topic;
  caption = removeUnrelatedTickerLeak(caption, strategy);
  caption = repairIncompleteCaptionEnd(caption);

  if (isStockEducation && !/not (personalized )?financial advice/i.test(caption)) {
    caption = `${caption}\n\nEducational only, not financial advice.`;
  } else if (!/educational/i.test(caption)) {
    caption = `${caption}\n\nEducational general information only.`;
  }

  if (cta && shouldAppendCta(caption, cta)) {
    caption = `${caption}\n\n${cta}`;
  }

  caption = truncateCaption(caption, MAX_CAPTION_CHARS, isStockEducation);

  return {
    caption,
    hashtags: buildHashtagString(bundle.hashtags, strategy),
    cta,
    firstComment: truncateText(cleanCopyArtifacts(stripHashtags(bundle.firstComment || fallbackFirstComment(strategy))).trim(), MAX_FIRST_COMMENT_CHARS),
    altText: truncateText(cleanCopyArtifacts(bundle.altText || `TheStatsAndStacks post about ${strategy.topic}.`).trim(), 1000),
  };
}

function buildHashtagString(value: string, strategy: StrategyDecision): string {
  const extracted = (value.match(/#[A-Za-z0-9_]+/g) || [])
    .map((tag) => tag.replace(/_+/g, '_'));
  const defaults = getDefaultHashtags(strategy);
  const seen = new Set<string>();
  const hashtags: string[] = [];

  for (const tag of [...extracted, ...defaults]) {
    const normalized = tag.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    hashtags.push(tag);
    if (hashtags.length >= MAX_HASHTAGS) break;
  }

  return hashtags.join(' ');
}

function getDefaultHashtags(strategy: StrategyDecision): string[] {
  if (isStockEducationTopic(strategy)) {
    return [
      '#CanadianFinance',
      '#InvestingCanada',
      '#StockMarketEducation',
      '#RiskManagement',
      '#PersonalFinanceCanada',
    ];
  }

  if (/tfsa|rrsp|fhsa|account/i.test(strategy.topic)) {
    return [
      '#CanadianFinance',
      '#PersonalFinanceCanada',
      '#InvestingCanada',
      '#FinancialLiteracy',
      '#MoneyTips',
    ];
  }

  return [
    '#CanadianFinance',
    '#PersonalFinanceCanada',
    '#MoneyTips',
    '#FinancialLiteracy',
    '#InvestingCanada',
  ];
}

function stripHashtags(value: string): string {
  return value
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
    .replace(/(?:^|\s)#[A-Za-z0-9_]+/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanCopyArtifacts(value: string): string {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function removeUnrelatedTickerLeak(value: string, strategy: StrategyDecision): string {
  const allowedTickers = new Set((strategy.topic.match(/\(([A-Z]{1,6})\)/g) || [])
    .map((ticker) => ticker.replace(/[()]/g, '')));
  if (allowedTickers.size === 0) return value;

  const unrelatedTickerPattern = /\b(AMD|NVDA|AVGO|WDC|MU|SMCI|TSLA|PLTR|APP|HOOD|COIN|MSTR|RKLB|IONQ|SOFI)\b/g;
  return value
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const tickers = sentence.match(unrelatedTickerPattern) || [];
      return tickers.every((ticker) => allowedTickers.has(ticker));
    })
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function shouldAppendCta(caption: string, cta: string): boolean {
  const normalizedCaption = caption.toLowerCase();
  const normalizedCta = cta.toLowerCase();
  if (normalizedCaption.includes(normalizedCta)) return false;
  const captionHasFollow = /\bfollow\s+@?thestatsandstacks\b/i.test(caption);
  const ctaHasFollow = /\bfollow\s+@?thestatsandstacks\b/i.test(cta);
  const captionHasSave = /\bsave\b/i.test(caption);
  const ctaHasSave = /\bsave\b/i.test(cta);
  return !(captionHasFollow && ctaHasFollow && captionHasSave && ctaHasSave);
}

function truncateCaption(value: string, maxChars: number, includeAdviceDisclaimer: boolean): string {
  if (value.length <= maxChars) return value;

  const disclaimer = includeAdviceDisclaimer
    ? 'Educational only, not financial advice.'
    : 'Educational general information only.';
  const roomForDisclaimer = maxChars - disclaimer.length - 2;
  const draft = value.slice(0, Math.max(0, roomForDisclaimer));
  const paragraphBreak = draft.lastIndexOf('\n\n');
  const sentenceBreak = Math.max(draft.lastIndexOf('. '), draft.lastIndexOf('? '), draft.lastIndexOf('! '));
  const cutAt = paragraphBreak > 240 ? paragraphBreak : sentenceBreak > 240 ? sentenceBreak + 1 : roomForDisclaimer;
  return `${draft.slice(0, cutAt).trim()}\n\n${disclaimer}`.slice(0, maxChars).trim();
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars - 1).trimEnd();
}

function fallbackCta(strategy: StrategyDecision): string {
  return strategy.format === 'SINGLE_IMAGE'
    ? 'Save this before your next money check.'
    : 'Save this before your next money decision.';
}

function fallbackFirstComment(strategy: StrategyDecision): string {
  return isStockEducationTopic(strategy)
    ? 'What do you check first: business quality, valuation, or risk?'
    : 'Which part would you fix first?';
}

function buildGrowthCta(value: string, strategy: StrategyDecision): string {
  const cleaned = stripHashtags(value).replace(/\s+/g, ' ').trim() || fallbackCta(strategy);
  const followReason = getFollowerReason(strategy);
  if (/\bfollow\b/i.test(cleaned)) return truncateText(cleaned, 160);
  const combined = `${cleaned} ${followReason}`;
  return truncateText(combined.length <= 160 ? combined : followReason, 160);
}

function getFollowerReason(strategy: StrategyDecision): string {
  if (isStockEducationTopic(strategy) || /portfolio/i.test(strategy.topic)) {
    return `Follow ${BRAND_FOLLOW_NAME} for calm investing frameworks without hype.`;
  }

  return `Follow ${BRAND_FOLLOW_NAME} for one clear Canadian money framework a day.`;
}

function isStockEducationTopic(strategy: StrategyDecision): boolean {
  const text = [
    strategy.topic,
    strategy.format,
    ...(strategy.searchKeywords || []),
  ].join(' ');

  return (
    strategy.format === 'WATCHLIST_EDUCATION'
    || /\([A-Z]{1,6}\)/.test(strategy.topic)
    || /stock|watchlist|invest|earnings|market|etf|ticker|valuation|portfolio|semiconductor|data storage|ai storage|sandisk|micron|western digital|super micro|amd|nvidia|broadcom/i.test(text)
  );
}

function repairIncompleteCaptionEnd(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /[.!?)]$/.test(trimmed)) return trimmed;

  const lastSentenceEnd = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf('!'),
    trimmed.lastIndexOf('?')
  );

  if (lastSentenceEnd > 120) {
    return trimmed.slice(0, lastSentenceEnd + 1).trim();
  }

  return trimmed.replace(/\s+\S*$/, '').trim();
}
