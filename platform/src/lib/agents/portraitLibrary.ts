export type PortraitCategory =
  | 'TECH_CEO'
  | 'INVESTOR'
  | 'CANADIAN'
  | 'POLITICAL'
  | 'SPORTS';

export type LikenessConfidence = 'high' | 'medium' | 'low';

export type TopicCategory =
  | 'EARNINGS'
  | 'MACRO'
  | 'POLICY'
  | 'TAX_ACCT'
  | 'CRYPTO'
  | 'COMMODITY'
  | 'HOUSING'
  | 'BEHAVIORAL'
  | 'HOW_TO'
  | 'CAP_TABLE';

export interface NamedPortrait {
  slug: string;
  displayName: string;
  category: PortraitCategory;
  likenessConfidence: LikenessConfidence;
  topicAffinity: TopicCategory[];
  legalNote: string;
  promptHint: string;
}

export interface ArchetypePortrait {
  slug: string;
  displayName: string;
  promptDescription: string;
  topicAffinity: TopicCategory[];
}

export const TIER_1_NAMED: NamedPortrait[] = [
  { slug: 'trump', displayName: 'Donald Trump', category: 'POLITICAL', likenessConfidence: 'high', topicAffinity: ['MACRO', 'POLICY', 'CAP_TABLE'], legalNote: 'public official, fair-use newsworthy commentary', promptHint: 'Donald Trump in a dark suit with a red tie, dramatic side-lit, confident pose' },
  { slug: 'buffett', displayName: 'Warren Buffett', category: 'INVESTOR', likenessConfidence: 'high', topicAffinity: ['CAP_TABLE', 'BEHAVIORAL', 'HOW_TO'], legalNote: 'named professional investor, public commentary', promptHint: 'Warren Buffett in a charcoal suit, friendly, warm studio lighting' },
  { slug: 'powell', displayName: 'Jerome Powell', category: 'POLITICAL', likenessConfidence: 'high', topicAffinity: ['MACRO', 'POLICY'], legalNote: 'central bank chair, public official', promptHint: 'Jerome Powell at a podium with a navy tie, serious expression' },
  { slug: 'jensen_huang', displayName: 'Jensen Huang', category: 'TECH_CEO', likenessConfidence: 'high', topicAffinity: ['EARNINGS', 'CAP_TABLE'], legalNote: 'public-company CEO, newsworthy commentary', promptHint: 'Jensen Huang in his signature black leather jacket, holding a glowing chip' },
  { slug: 'tim_cook', displayName: 'Tim Cook', category: 'TECH_CEO', likenessConfidence: 'high', topicAffinity: ['EARNINGS', 'CAP_TABLE'], legalNote: 'public-company CEO', promptHint: 'Tim Cook in a dark crewneck and dress trousers, soft Apple-store lighting' },
  { slug: 'elon_musk', displayName: 'Elon Musk', category: 'TECH_CEO', likenessConfidence: 'high', topicAffinity: ['EARNINGS', 'MACRO', 'CAP_TABLE'], legalNote: 'public-company CEO', promptHint: 'Elon Musk in a black t-shirt under a dark blazer, slight smirk, factory backdrop' },
  { slug: 'pelosi', displayName: 'Nancy Pelosi', category: 'POLITICAL', likenessConfidence: 'high', topicAffinity: ['POLICY', 'CAP_TABLE'], legalNote: 'public official', promptHint: 'Nancy Pelosi in a bright pantsuit, confident pose, Capitol-style backdrop' },
  { slug: 'trudeau', displayName: 'Justin Trudeau', category: 'CANADIAN', likenessConfidence: 'high', topicAffinity: ['POLICY', 'TAX_ACCT', 'HOUSING'], legalNote: 'public official, Canadian PM', promptHint: 'Justin Trudeau in a navy suit, candid, soft window light' },
  { slug: 'satya_nadella', displayName: 'Satya Nadella', category: 'TECH_CEO', likenessConfidence: 'high', topicAffinity: ['EARNINGS', 'CAP_TABLE'], legalNote: 'public-company CEO', promptHint: 'Satya Nadella in a black sweater and dark jeans, intellectual studio portrait' },
  { slug: 'mark_zuckerberg', displayName: 'Mark Zuckerberg', category: 'TECH_CEO', likenessConfidence: 'high', topicAffinity: ['EARNINGS', 'CAP_TABLE'], legalNote: 'public-company CEO', promptHint: 'Mark Zuckerberg in a grey t-shirt, mid-stride, contemporary tech office backdrop' },

  { slug: 'cathie_wood', displayName: 'Cathie Wood', category: 'INVESTOR', likenessConfidence: 'medium', topicAffinity: ['CAP_TABLE', 'BEHAVIORAL'], legalNote: 'named professional investor', promptHint: 'Cathie Wood in a teal blazer, confident smile, modern studio backdrop' },
  { slug: 'bill_ackman', displayName: 'Bill Ackman', category: 'INVESTOR', likenessConfidence: 'medium', topicAffinity: ['CAP_TABLE'], legalNote: 'named professional investor', promptHint: 'Bill Ackman in a charcoal suit, intense gaze, executive boardroom backdrop' },
  { slug: 'sundar_pichai', displayName: 'Sundar Pichai', category: 'TECH_CEO', likenessConfidence: 'medium', topicAffinity: ['EARNINGS', 'CAP_TABLE'], legalNote: 'public-company CEO', promptHint: 'Sundar Pichai in a navy blazer over open-collar shirt, calm smile' },
  { slug: 'lisa_su', displayName: 'Lisa Su', category: 'TECH_CEO', likenessConfidence: 'medium', topicAffinity: ['EARNINGS', 'CAP_TABLE'], legalNote: 'public-company CEO', promptHint: 'Lisa Su in a black blazer, holding an AMD chip, professional studio lighting' },
  { slug: 'michael_burry', displayName: 'Michael Burry', category: 'INVESTOR', likenessConfidence: 'medium', topicAffinity: ['CAP_TABLE', 'BEHAVIORAL'], legalNote: 'named professional investor', promptHint: 'Michael Burry in a casual t-shirt and dark jeans, intense look, slightly disheveled' },
  { slug: 'stan_druckenmiller', displayName: 'Stan Druckenmiller', category: 'INVESTOR', likenessConfidence: 'medium', topicAffinity: ['MACRO', 'CAP_TABLE'], legalNote: 'named professional investor', promptHint: 'Stan Druckenmiller in a navy suit, silver hair, contemplative pose' },
  { slug: 'ray_dalio', displayName: 'Ray Dalio', category: 'INVESTOR', likenessConfidence: 'medium', topicAffinity: ['MACRO', 'BEHAVIORAL'], legalNote: 'named professional investor', promptHint: 'Ray Dalio in a quarter-zip pullover, professorial, warm tones' },
  { slug: 'mark_carney', displayName: 'Mark Carney', category: 'CANADIAN', likenessConfidence: 'medium', topicAffinity: ['MACRO', 'POLICY'], legalNote: 'former central bank governor', promptHint: 'Mark Carney in a dark navy suit and red tie, central-bank press conference setting' },
  { slug: 'tiff_macklem', displayName: 'Tiff Macklem', category: 'CANADIAN', likenessConfidence: 'medium', topicAffinity: ['MACRO', 'POLICY'], legalNote: 'Bank of Canada Governor', promptHint: 'Tiff Macklem at a podium with the Bank of Canada logo backdrop' },
  { slug: 'christine_lagarde', displayName: 'Christine Lagarde', category: 'POLITICAL', likenessConfidence: 'medium', topicAffinity: ['MACRO', 'POLICY'], legalNote: 'ECB President, public official', promptHint: 'Christine Lagarde in a tailored cream blazer, silver bob, elegant pose' },

  { slug: 'chrystia_freeland', displayName: 'Chrystia Freeland', category: 'CANADIAN', likenessConfidence: 'low', topicAffinity: ['POLICY', 'TAX_ACCT'], legalNote: 'public official, Canadian finance minister', promptHint: 'Chrystia Freeland in a structured blazer at a House of Commons podium' },
  { slug: 'andy_jassy', displayName: 'Andy Jassy', category: 'TECH_CEO', likenessConfidence: 'low', topicAffinity: ['EARNINGS', 'CAP_TABLE'], legalNote: 'public-company CEO', promptHint: 'Andy Jassy in a dress shirt with rolled sleeves, Amazon-style modern office backdrop' },
  { slug: 'sam_altman', displayName: 'Sam Altman', category: 'TECH_CEO', likenessConfidence: 'low', topicAffinity: ['EARNINGS', 'CAP_TABLE'], legalNote: 'AI company CEO, frequently public', promptHint: 'Sam Altman in a navy quarter-zip, casual studio portrait' },
  { slug: 'howard_marks', displayName: 'Howard Marks', category: 'INVESTOR', likenessConfidence: 'low', topicAffinity: ['BEHAVIORAL', 'MACRO'], legalNote: 'named professional investor', promptHint: 'Howard Marks in a grey suit, glasses, scholarly demeanor' },
  { slug: 'galen_weston', displayName: 'Galen Weston', category: 'CANADIAN', likenessConfidence: 'low', topicAffinity: ['CAP_TABLE', 'POLICY'], legalNote: 'public-company CEO', promptHint: 'Galen Weston in a navy suit, Loblaws-grocery aisle backdrop' },
  { slug: 'tobi_lutke', displayName: 'Tobi Lütke', category: 'CANADIAN', likenessConfidence: 'low', topicAffinity: ['EARNINGS', 'CAP_TABLE'], legalNote: 'Shopify CEO, public-company executive', promptHint: 'Tobi Lütke in a fitted dark t-shirt, slightly bearded, tech-company backdrop' },
];

export const TIER_2_ARCHETYPES: ArchetypePortrait[] = [
  { slug: 'silver_haired_pm', displayName: 'Senior Portfolio Manager', promptDescription: 'a sharp 50-something portfolio manager with silver hair, navy chalk-stripe suit, no tie, sitting across a marble desk', topicAffinity: ['CAP_TABLE', 'MACRO', 'BEHAVIORAL'] },
  { slug: 'female_quant_30s', displayName: 'Quantitative Analyst', promptDescription: 'a focused 30-something female quant in cream turtleneck and tortoiseshell glasses, against a wall of monitors', topicAffinity: ['EARNINGS', 'BEHAVIORAL', 'HOW_TO'] },
  { slug: 'young_retail_trader', displayName: 'Retail Day Trader', promptDescription: 'a hoodie-wearing 25-year-old at a multi-monitor desk, dim room, glow from screens on his face', topicAffinity: ['CRYPTO', 'BEHAVIORAL'] },
  { slug: 'seasoned_canadian_banker', displayName: 'Bay Street Banker', promptDescription: 'a tailored 60-year-old Bay Street banker in a charcoal three-piece, gold watch chain, sharp lapel pin', topicAffinity: ['MACRO', 'TAX_ACCT', 'CAP_TABLE'] },
  { slug: 'crypto_native_founder', displayName: 'Crypto Native Founder', promptDescription: 'a tattooed 30-something founder in a black tee, neon backlight from RGB monitors, intense gaze', topicAffinity: ['CRYPTO', 'CAP_TABLE'] },
  { slug: 'boomer_diy_investor', displayName: 'DIY Boomer Investor', promptDescription: 'a 65-year-old Canadian investor in a cardigan at a sunlit dining table, reading materials and a coffee cup nearby', topicAffinity: ['TAX_ACCT', 'HOW_TO', 'BEHAVIORAL'] },
  { slug: 'retiree_with_charts', displayName: 'Retiree With Charts', promptDescription: 'a 70-something retiree at home office, reading glasses, soft afternoon light, paper charts on the desk', topicAffinity: ['TAX_ACCT', 'BEHAVIORAL', 'HOW_TO'] },
  { slug: 'millennial_dad_with_laptop', displayName: 'Millennial Dad', promptDescription: 'a 34-year-old dad at kitchen table, laptop open, casual button-down, slight smile, warm morning light', topicAffinity: ['HOUSING', 'TAX_ACCT', 'HOW_TO'] },
  { slug: 'immigrant_entrepreneur', displayName: 'First-Generation Entrepreneur', promptDescription: 'a first-gen founder in their mid-40s, business-casual, warm rim light, modest office backdrop', topicAffinity: ['CAP_TABLE', 'BEHAVIORAL'] },
  { slug: 'female_cfo_50s', displayName: 'Female CFO', promptDescription: 'a professional 50-something CFO in a tailored blazer, executive boardroom backdrop, controlled lighting', topicAffinity: ['EARNINGS', 'CAP_TABLE', 'MACRO'] },
  { slug: 'quiet_boomer_landlord', displayName: 'Boomer Landlord', promptDescription: 'a 60-something landlord with weathered hands going over property files at a wood-grain desk', topicAffinity: ['HOUSING', 'TAX_ACCT'] },
  { slug: 'canadian_uni_grad_25', displayName: 'Recent Canadian Graduate', promptDescription: 'a recent graduate in a modest Toronto apartment with a laptop and TFSA paperwork, late-twenties, hopeful posture', topicAffinity: ['TAX_ACCT', 'HOW_TO', 'HOUSING'] },
];

export const NAMED_BY_SLUG: Record<string, NamedPortrait> = Object.fromEntries(
  TIER_1_NAMED.map((p) => [p.slug, p]),
);

export const ARCHETYPE_BY_SLUG: Record<string, ArchetypePortrait> = Object.fromEntries(
  TIER_2_ARCHETYPES.map((a) => [a.slug, a]),
);

import { lruRank } from '../services/lruPicker';
import { TICKER_LOGO_MAP } from './tickerLogoAgent';

export interface PortraitSelection {
  tier: 1 | 2;
  slug: string;
  displayName: string;
  promptHint: string;
}

export function pickPortrait(input: {
  topicCategory: TopicCategory;
  isCoverSlide: boolean;
  recentPortraitSlugs: string[];
  recentArchetypeSlugs: string[];
  deterministicSeed: string;
  tickers?: string[];
  topicTitle?: string;
}): PortraitSelection {
  const isCanadian = input.topicTitle && /canada|canadian|tsx|\.to\b|cppib|cdpq|tfsa|rrsp|fhsa/i.test(input.topicTitle);

  // 1. Resolve ticker-mapped portraits
  let tickerPortraitCandidates: NamedPortrait[] = [];
  if (input.tickers && input.tickers.length > 0) {
    const subjects = input.tickers
      .map((t) => TICKER_LOGO_MAP[t]?.portraitSubject)
      .filter((s): s is string => Boolean(s));
    
    tickerPortraitCandidates = Array.from(new Set(subjects))
      .map((slug) => NAMED_BY_SLUG[slug])
      .filter((p): p is NamedPortrait => Boolean(p));
  }

  // 2. Determine named candidates
  let namedCandidates: NamedPortrait[] = [];
  
  if (tickerPortraitCandidates.length > 0) {
    // Priority: Filter ticker-mapped portraits against recentPortraitSlugs to see if any are fresh.
    const freshTickerCandidates = tickerPortraitCandidates.filter((p) => !input.recentPortraitSlugs.includes(p.slug));
    // If we have mapped portraits, we MUST pick from them even if they are all in the avoid list (bypassing LRU if necessary).
    namedCandidates = freshTickerCandidates.length > 0 ? freshTickerCandidates : tickerPortraitCandidates;
  } else {
    // Standard pool filtered by topic affinity
    let namedPool = TIER_1_NAMED.filter((p) => p.topicAffinity.includes(input.topicCategory));
    
    // Apply Canadian preference to named portraits
    if (isCanadian) {
      const canadianPool = namedPool.filter((p) => p.category === 'CANADIAN');
      if (canadianPool.length > 0) {
        namedPool = canadianPool;
      }
    } else {
      const nonCanadianPool = namedPool.filter((p) => p.category !== 'CANADIAN');
      if (nonCanadianPool.length > 0) {
        namedPool = nonCanadianPool;
      }
    }

    namedCandidates = namedPool.filter((p) => !input.recentPortraitSlugs.includes(p.slug));
    
    if (input.isCoverSlide) {
      const highOnly = namedCandidates.filter((p) => p.likenessConfidence === 'high');
      if (highOnly.length > 0) namedCandidates = highOnly;
    }
  }

  if (namedCandidates.length > 0) {
    const ranked = lruRank(
      namedCandidates.map((p) => p.slug),
      input.recentPortraitSlugs,
      50,
    );
    const seedOffset = simpleHash(input.deterministicSeed) % Math.max(1, Math.min(ranked.length, 3));
    const chosenSlug = ranked[seedOffset];
    const chosen = NAMED_BY_SLUG[chosenSlug];
    return { tier: 1, slug: chosen.slug, displayName: chosen.displayName, promptHint: chosen.promptHint };
  }

  // Fallback to Archetypes
  let archPool = TIER_2_ARCHETYPES.filter((a) => a.topicAffinity.includes(input.topicCategory));
  if (archPool.length === 0) archPool = TIER_2_ARCHETYPES;

  // Apply Canadian preference to archetypes
  if (isCanadian) {
    const canadianArchs = archPool.filter((a) => 
      a.slug === 'seasoned_canadian_banker' || 
      a.slug === 'boomer_diy_investor' || 
      a.slug === 'canadian_uni_grad_25'
    );
    if (canadianArchs.length > 0) {
      archPool = canadianArchs;
    }
  } else {
    const nonCanadianArchs = archPool.filter((a) => 
      a.slug !== 'seasoned_canadian_banker' && 
      a.slug !== 'canadian_uni_grad_25'
    );
    if (nonCanadianArchs.length > 0) {
      archPool = nonCanadianArchs;
    }
  }

  const archCandidates = archPool.filter((a) => !input.recentArchetypeSlugs.includes(a.slug));
  const ranked = lruRank(
    (archCandidates.length > 0 ? archCandidates : archPool).map((a) => a.slug),
    input.recentArchetypeSlugs,
    50,
  );
  const seedOffset = simpleHash(input.deterministicSeed) % Math.max(1, Math.min(ranked.length, 3));
  const chosen = ARCHETYPE_BY_SLUG[ranked[seedOffset]];
  return { tier: 2, slug: chosen.slug, displayName: chosen.displayName, promptHint: chosen.promptDescription };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
