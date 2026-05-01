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
- Use "educational only, not financial advice" language.
- Write for saves and shares: clear first line, useful framework, no cheap engagement bait.
- Caption must be under ${MAX_CAPTION_CHARS} characters. The first line must work before Instagram's "more" truncation.
- Use 3-5 focused hashtags, never more than ${MAX_HASHTAGS}.
- Naturally include search terms from: ${input.strategy.searchKeywords.join(', ')}
- Vary the CTA. Prefer save/share/profile-follow prompts only when they fit the post.
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
      const isStockEducation = input.strategy.format === 'WATCHLIST_EDUCATION'
        || /stock|watchlist|invest|earnings|market|etf/i.test(input.strategy.topic);
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
  const cta = truncateText((bundle.cta || fallbackCta(strategy)).trim(), 160);
  const isStockEducation = strategy.format === 'WATCHLIST_EDUCATION'
    || /stock|watchlist|invest|earnings|market|etf/i.test(strategy.topic);

  let caption = stripHashtags(bundle.caption || '').trim();
  if (!caption) caption = strategy.topic;

  if (isStockEducation && !/not (personalized )?financial advice/i.test(caption)) {
    caption = `${caption}\n\nEducational only, not financial advice.`;
  } else if (!/educational/i.test(caption)) {
    caption = `${caption}\n\nEducational general information only.`;
  }

  if (cta && !caption.toLowerCase().includes(cta.toLowerCase())) {
    caption = `${caption}\n\n${cta}`;
  }

  caption = truncateCaption(caption, MAX_CAPTION_CHARS, isStockEducation);

  return {
    caption,
    hashtags: buildHashtagString(bundle.hashtags, strategy),
    cta,
    firstComment: truncateText(stripHashtags(bundle.firstComment || fallbackFirstComment(strategy)).trim(), MAX_FIRST_COMMENT_CHARS),
    altText: truncateText((bundle.altText || `TheStatsAndStacks post about ${strategy.topic}.`).trim(), 1000),
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
  if (strategy.format === 'WATCHLIST_EDUCATION' || /stock|watchlist|earnings|market|etf/i.test(strategy.topic)) {
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
  return strategy.format === 'REEL_DRAFT'
    ? 'Save this before your next money check.'
    : 'Save this before your next money decision.';
}

function fallbackFirstComment(strategy: StrategyDecision): string {
  return /stock|watchlist|earnings|market|etf/i.test(strategy.topic)
    ? 'What do you check first: business quality, valuation, or risk?'
    : 'Which part would you fix first?';
}
