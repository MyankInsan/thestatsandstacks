import { BaseAgent, TrendResearchResult } from './interfaces';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';

export class TrendResearchAgent extends BaseAgent {
  constructor() {
    super('TrendResearchAgent');
  }

  async execute(_input?: unknown): Promise<TrendResearchResult> {
    void _input;
    console.log(`[${this.name}] 🔍 Starting deep trend research...`);

    const today = new Date();
    const todayLabel = today.toLocaleDateString('en-CA');
    const researchCandidates = buildResearchBacklog(today);

    const prompt = `You are an elite Instagram growth strategist and financial content researcher for "TheStatsAndStacks", a premium Canadian personal finance brand on Instagram.

Today's date is ${todayLabel}.

Your job is to find the BEST possible topic for today's post that will maximize:
- Saves (the #1 signal for Instagram reach)
- Shares (the #2 signal)
- New followers
- Search discoverability inside Instagram

RESEARCH APPROACH:
1. Think about what Canadian personal finance topics people are actively searching for RIGHT NOW
2. Consider seasonal timing (tax season, RRSP deadline, new year goals, back to school, etc.)
3. Consider what formats perform best on finance Instagram (comparisons, myth-busters, step-by-step, "I wish I knew", number breakdowns)
4. Consider what would make someone STOP scrolling and tap "Save"
5. Avoid oversaturated topics unless you have a genuinely fresh angle
6. Pick the best format: CAROUSEL, SINGLE_IMAGE, or WATCHLIST_EDUCATION
7. For stocks, never recommend buy/sell/hold. Use educational watchlists, risk breakdowns, valuation checklists, or earnings explainer formats only.

CONTENT PILLARS TO DRAW FROM:
- TFSA vs RRSP vs FHSA comparisons
- Canadian tax strategies and deductions
- GIC vs HISA vs ETF comparisons
- First-time home buyer programs
- Dividend investing for Canadians
- Credit score optimization
- stock education without recommendations
- market literacy and risk management

RESEARCH BACKLOG AND SOURCE SIGNALS:
${JSON.stringify(researchCandidates, null, 2)}

Return your TOP 7 topic ideas ranked by predicted performance.

Output ONLY valid JSON matching this schema (no markdown, no code fences):
{
  "topics": [
    {
      "title": "The exact post title/hook",
      "score": 0.0-1.0,
      "reasoning": "Why this will perform well today",
      "suggestedFormat": "CAROUSEL" or "SINGLE_IMAGE" or "WATCHLIST_EDUCATION",
      "suggestedSlideCount": number,
      "searchKeywords": ["keyword1", "keyword2"],
      "sourceUrls": []
    }
  ]
    }`;

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      if (!text) throw new Error('No content returned from Gemini');

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned) as TrendResearchResult;

      console.log(`[${this.name}] ✅ Found ${parsed.topics.length} topic candidates`);
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.name}] Gemini research failed; using cost-safe fallback topics. ${message}`);
      return {
        topics: researchCandidates.slice(0, 7),
      };
    }
  }
}

type ResearchCandidate = NonNullable<TrendResearchResult['topics'][number]>;

function buildResearchBacklog(today: Date): ResearchCandidate[] {
  const month = today.getMonth();
  const day = today.getDate();
  const dayIndex = Math.floor(today.getTime() / 86_400_000);
  const seasonalBoost = getSeasonalBoost(month, day);
  const candidates: ResearchCandidate[] = [
    {
      title: 'TFSA vs RRSP vs FHSA: Which Account Should Canadians Use First?',
      score: 0.84 + seasonalBoost.accountPlanning,
      reasoning: 'Evergreen Canadian account comparison with strong save/share intent and search demand.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['TFSA vs RRSP', 'FHSA Canada', 'Canadian investing accounts'],
      sourceUrls: [
        'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account.html',
        'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html',
      ],
    },
    {
      title: 'The Canadian Payday Order of Operations',
      score: 0.82 + (day <= 5 || day >= 25 ? 0.06 : 0),
      reasoning: 'Payday routines are repeatable, saveable, and useful at the start/end of each month.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 8,
      searchKeywords: ['payday routine', 'budget checklist', 'Canadian personal finance'],
      sourceUrls: ['https://www.canada.ca/en/financial-consumer-agency/services/budgeting.html'],
    },
    {
      title: '5 Money Leaks Quietly Keeping Canadians Broke',
      score: 0.8,
      reasoning: 'Mistake teardown posts create recognition and comments without becoming cheap engagement bait.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['budgeting Canada', 'money leaks', 'personal finance Canada'],
      sourceUrls: ['https://www.canada.ca/en/financial-consumer-agency/services/budgeting.html'],
    },
    {
      title: 'Credit Score Myths Canadians Still Believe',
      score: 0.78,
      reasoning: 'Myth/fact content is shareable and useful for younger Canadian finance audiences.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['credit score Canada', 'credit myths', 'Canadian credit cards'],
      sourceUrls: ['https://www.canada.ca/en/financial-consumer-agency/services/credit-reports-score.html'],
    },
    {
      title: 'HISA vs GIC vs ETF: Where Should Short-Term Money Go?',
      score: 0.79 + seasonalBoost.rateSensitivity,
      reasoning: 'Timeline frameworks help people choose tools without giving individualized recommendations.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 8,
      searchKeywords: ['HISA vs GIC', 'ETF Canada', 'short term savings Canada'],
      sourceUrls: [
        'https://www.canada.ca/en/financial-consumer-agency/services/banking/bank-accounts/savings-account.html',
        'https://www.getsmarteraboutmoney.ca/invest/investment-products/gics/',
      ],
    },
    {
      title: 'Stock Watchlist Rule: 5 Checks Before You Buy Any Stock',
      score: 0.77 + (dayIndex % 6 === 0 ? 0.08 : 0),
      reasoning: 'Stock content can attract reach, but this keeps the post educational and avoids buy/sell recommendations.',
      suggestedFormat: 'WATCHLIST_EDUCATION',
      suggestedSlideCount: 8,
      searchKeywords: ['how to evaluate stocks', 'stock watchlist', 'investing checklist'],
      sourceUrls: [
        'https://www.osc.ca/en/investors/investor-research-and-reports/social-media-and-retail-investing-rise-finfluencers',
        'https://www.ciro.ca/newsroom/publications/joint-canadian-securities-administrators-and-canadian-investment-regulatory-organization-staff',
      ],
    },
    {
      title: 'Before Chasing a Hot Stock, Check These 4 Risks',
      score: 0.75 + (dayIndex % 9 === 0 ? 0.08 : 0),
      reasoning: 'Timely-feeling stock education is engaging while still warning against hype and concentration risk.',
      suggestedFormat: 'WATCHLIST_EDUCATION',
      suggestedSlideCount: 7,
      searchKeywords: ['stock risk checklist', 'hot stocks', 'investing risk'],
      sourceUrls: [
        'https://www.osc.ca/en/investors/investor-research-and-reports/social-media-and-retail-investing-rise-finfluencers',
        'https://www.ciro.ca/newsroom/publications/joint-canadian-securities-administrators-and-canadian-investment-regulatory-organization-staff',
      ],
    },
  ];

  return candidates
    .sort((a, b) => b.score - a.score)
    .map((candidate, index) => ({
      ...candidate,
      score: Math.min(0.95, Number((candidate.score - index * 0.005).toFixed(3))),
    }));
}

function getSeasonalBoost(month: number, day: number): { accountPlanning: number; rateSensitivity: number } {
  return {
    accountPlanning: month <= 2 || (month === 11 && day >= 15) ? 0.08 : 0,
    rateSensitivity: month === 0 || month === 3 || month === 6 || month === 9 ? 0.04 : 0,
  };
}
