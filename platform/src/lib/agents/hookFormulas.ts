export type HookFormulaId =
  | 'RECEIPT_DROP'
  | 'CAP_TABLE'
  | 'ANTI_FOMO'
  | 'IF_THEN_LADDER'
  | 'COMPARISON_LADDER'
  | 'QUIET_NUMBER'
  | 'REVERSE_SURVIVORSHIP'
  | 'DECISION_FORK'
  | 'BEHIND_THE_SCENES'
  | 'MYTH_STRIKE'
  | 'TAX_DRAG'
  | 'COHORT_TRUTH'
  | 'TIME_CAPSULE'
  | 'PATTERN_SPOT'
  | 'RECEIPTS_SIDE_BY_SIDE'
  | 'CALENDAR_TRIGGER'
  | 'PREMIUM_CONTRARIAN'
  | 'QUIET_COMPOUNDER';

export interface HookFormula {
  id: HookFormulaId;
  pattern: string;
  whenToUse: string;
  exampleFill: string;
  bestFor: Array<'saves' | 'shares' | 'profile_visits' | 'follows' | 'comments'>;
  clickbaitRisk: 'low' | 'medium';
}

export const HOOK_FORMULAS: Record<HookFormulaId, HookFormula> = {
  RECEIPT_DROP: {
    id: 'RECEIPT_DROP',
    pattern: "I pulled {Person}'s {filing}. Here's what's in it",
    whenToUse: 'When citing a public document or disclosure (13F, STOCK Act, annual report)',
    exampleFill: "I pulled Nancy Pelosi's latest disclosure. Here's what's in it",
    bestFor: ['saves', 'shares'],
    clickbaitRisk: 'low',
  },
  CAP_TABLE: {
    id: 'CAP_TABLE',
    pattern: 'Who actually owns {Co}?',
    whenToUse: 'Institutional ownership breakdowns of recognized companies',
    exampleFill: 'Who actually owns Shopify?',
    bestFor: ['saves', 'profile_visits'],
    clickbaitRisk: 'low',
  },
  ANTI_FOMO: {
    id: 'ANTI_FOMO',
    pattern: '{Stock} is up {window}. Should you care?',
    whenToUse: 'Hot-ticker moments where viewers feel FOMO; reframe to risk-first thinking',
    exampleFill: 'NVDA is up 38% YTD. Should you care?',
    bestFor: ['saves', 'follows'],
    clickbaitRisk: 'medium',
  },
  IF_THEN_LADDER: {
    id: 'IF_THEN_LADDER',
    pattern: 'If you {situation}, do this 1 thing first',
    whenToUse: 'Decision-tree educational content',
    exampleFill: "If you're maxing your TFSA, do this 1 thing first",
    bestFor: ['saves'],
    clickbaitRisk: 'low',
  },
  COMPARISON_LADDER: {
    id: 'COMPARISON_LADDER',
    pattern: '{A} vs {B} in {year}: the real winner',
    whenToUse: 'Product / strategy / account comparison content',
    exampleFill: 'XEQT vs VFV in 2026: the real winner',
    bestFor: ['saves', 'shares'],
    clickbaitRisk: 'low',
  },
  QUIET_NUMBER: {
    id: 'QUIET_NUMBER',
    pattern: 'The number nobody mentions about {familiar thing}',
    whenToUse: 'Hidden-stat content; must be substantiated by data in slide 2',
    exampleFill: 'The number nobody mentions about TFSA contribution room',
    bestFor: ['saves', 'shares'],
    clickbaitRisk: 'medium',
  },
  REVERSE_SURVIVORSHIP: {
    id: 'REVERSE_SURVIVORSHIP',
    pattern: "If you'd skipped {hyped} and bought the index",
    whenToUse: 'Hypothetical retrospective comparison content',
    exampleFill: "If you'd skipped GameStop and bought the index",
    bestFor: ['saves', 'shares'],
    clickbaitRisk: 'low',
  },
  DECISION_FORK: {
    id: 'DECISION_FORK',
    pattern: 'Most Canadians pick the wrong {account} first',
    whenToUse: 'Canadian account-selection educational content',
    exampleFill: 'Most Canadians pick the wrong retirement account first',
    bestFor: ['saves', 'follows'],
    clickbaitRisk: 'low',
  },
  BEHIND_THE_SCENES: {
    id: 'BEHIND_THE_SCENES',
    pattern: 'What {power figure} actually owns',
    whenToUse: 'Portfolio reveal content for known investors / executives / politicians',
    exampleFill: 'What Warren Buffett actually owns in 2026',
    bestFor: ['saves', 'profile_visits'],
    clickbaitRisk: 'low',
  },
  MYTH_STRIKE: {
    id: 'MYTH_STRIKE',
    pattern: '{common belief} is wrong. Here is why',
    whenToUse: 'Myth-bust content; must lead with substantive counter-evidence',
    exampleFill: 'Buying a home in Canada always beats renting is wrong. Here is why',
    bestFor: ['shares', 'comments'],
    clickbaitRisk: 'medium',
  },
  TAX_DRAG: {
    id: 'TAX_DRAG',
    pattern: 'Same ETF, three accounts. Look what you keep',
    whenToUse: 'Canadian taxation educational content',
    exampleFill: 'Same ETF, three accounts. Look what you keep',
    bestFor: ['saves'],
    clickbaitRisk: 'low',
  },
  COHORT_TRUTH: {
    id: 'COHORT_TRUTH',
    pattern: 'Average investor vs the index they held',
    whenToUse: 'Behavioral finance / investor-behavior data content',
    exampleFill: 'Average investor vs the S&P they held over 30 years',
    bestFor: ['saves', 'shares'],
    clickbaitRisk: 'low',
  },
  TIME_CAPSULE: {
    id: 'TIME_CAPSULE',
    pattern: 'What $10k in {ticker} 5 years ago looks like',
    whenToUse: 'Hypothetical historical investment storytelling',
    exampleFill: 'What $10k in NVIDIA 5 years ago looks like',
    bestFor: ['shares', 'saves'],
    clickbaitRisk: 'low',
  },
  PATTERN_SPOT: {
    id: 'PATTERN_SPOT',
    pattern: '{Power player} just bought {sector}. Three times in a row',
    whenToUse: 'Trend-spotting in institutional or insider activity',
    exampleFill: 'BlackRock just added to nuclear stocks. Three quarters in a row',
    bestFor: ['saves', 'shares'],
    clickbaitRisk: 'medium',
  },
  RECEIPTS_SIDE_BY_SIDE: {
    id: 'RECEIPTS_SIDE_BY_SIDE',
    pattern: 'Two ETFs, same name. Different result',
    whenToUse: 'Product / fund nuance content',
    exampleFill: 'Two S&P 500 ETFs, same name. Different result',
    bestFor: ['saves'],
    clickbaitRisk: 'low',
  },
  CALENDAR_TRIGGER: {
    id: 'CALENDAR_TRIGGER',
    pattern: 'Before {tax/contribution deadline}, check this',
    whenToUse: 'Time-bound Canadian finance content (RRSP deadline, TFSA reset, tax season)',
    exampleFill: 'Before the March RRSP deadline, check this',
    bestFor: ['saves', 'shares'],
    clickbaitRisk: 'low',
  },
  PREMIUM_CONTRARIAN: {
    id: 'PREMIUM_CONTRARIAN',
    pattern: 'Everyone says {X}. The disclosure says {Y}',
    whenToUse: 'Contrarian takes substantiated by primary documents',
    exampleFill: 'Everyone says Pelosi sold NVDA. The disclosure says she doubled down',
    bestFor: ['shares', 'comments'],
    clickbaitRisk: 'medium',
  },
  QUIET_COMPOUNDER: {
    id: 'QUIET_COMPOUNDER',
    pattern: '1% sounds small. Here is the 30-year math',
    whenToUse: 'Long-term math / compounding educational content',
    exampleFill: '1% MER sounds small. Here is the 30-year math',
    bestFor: ['saves'],
    clickbaitRisk: 'low',
  },
};

export function getHookFormula(id: HookFormulaId): HookFormula {
  return HOOK_FORMULAS[id];
}

export function isHookFormulaId(value: unknown): value is HookFormulaId {
  return typeof value === 'string' && value in HOOK_FORMULAS;
}
