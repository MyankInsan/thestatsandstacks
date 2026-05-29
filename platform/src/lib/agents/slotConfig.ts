import type { FormatType } from './formatStyleAgent';
import type { HookFormulaId } from './hookFormulas';
import type { CtaId } from './ctaLibrary';
import type { AngleId } from './topicAngleAgent';

export type SlotIndex = 1 | 2 | 3 | 4 | 5 | 6;

export type SlotPersona =
  | 'PRE_MARKET_NEWS'
  | 'PORTFOLIO_POWER_PLAYER'
  | 'DATA_EDUCATION'
  | 'CONTRARIAN_MYTH_BUST'
  | 'LIFESTYLE_STORYTELLING'
  | 'MEME_HUMOR';

export interface SlotConfig {
  index: SlotIndex;
  persona: SlotPersona;
  ptHour: number;
  ptMinute: number;
  allowedFormats: FormatType[];
  preferredAngles: AngleId[];
  preferredHookFormulas: HookFormulaId[];
  preferredCtas: CtaId[];
  description: string;
}

export const SLOT_CONFIGS: Record<SlotIndex, SlotConfig> = {
  1: {
    index: 1,
    persona: 'PRE_MARKET_NEWS',
    ptHour: 7,
    ptMinute: 0,
    allowedFormats: ['PHOTOREALISTIC_NEWS_FLASH', 'PHOTOREALISTIC_MARKET_UPDATE'],
    preferredAngles: [
      'CATALYST_NEWS', 'EARNINGS_REACTION', 'INDEX_REBALANCE', 'BUYBACK_SCOREBOARD',
    ],
    preferredHookFormulas: ['ANTI_FOMO', 'CALENDAR_TRIGGER', 'QUIET_NUMBER'],
    preferredCtas: ['follow_authority', 'save_specific', 'swipe_promise'],
    description: 'Pre-market briefing — news, macro, earnings reactions',
  },
  2: {
    index: 2,
    persona: 'PORTFOLIO_POWER_PLAYER',
    ptHour: 9,
    ptMinute: 0,
    allowedFormats: ['PHOTOREALISTIC_EXPERT_SHOCK', 'PHOTOREALISTIC_MARKET_UPDATE'],
    preferredAngles: [
      'CAP_TABLE_INSTITUTIONAL', 'F13_DELTA', 'SOVEREIGN_WEALTH', 'US_GOV_HOLDINGS',
      'POLITICIAN_DISCLOSURES', 'INSIDER_CLUSTERS', 'FOUNDER_CONCENTRATION',
      'CANADIAN_PENSION', 'SECTOR_CAP_TABLE',
    ],
    preferredHookFormulas: ['RECEIPT_DROP', 'CAP_TABLE', 'BEHIND_THE_SCENES', 'PATTERN_SPOT'],
    preferredCtas: ['share_use_case', 'comment_genuine_question', 'save_specific'],
    description: 'Portfolio / power-player content — 13F, cap-tables, who-owns-what',
  },
  3: {
    index: 3,
    persona: 'DATA_EDUCATION',
    ptHour: 11,
    ptMinute: 0,
    allowedFormats: ['PHOTOREALISTIC_MARKET_UPDATE', 'PHOTOREALISTIC_MINIMAL_TECH'],
    preferredAngles: [
      'ETF_XRAY', 'DIVIDEND_KINGS', 'FEE_TEARDOWN', 'TAX_DRAG_MAP', 'COMPARISON_LADDER',
    ],
    preferredHookFormulas: ['IF_THEN_LADDER', 'DECISION_FORK', 'COMPARISON_LADDER', 'QUIET_COMPOUNDER'],
    preferredCtas: ['save_specific', 'reference_save', 'comment_genuine_question', 'share_use_case'],
    description: 'Data / education — frameworks, sector explainers, comparisons',
  },
  4: {
    index: 4,
    persona: 'CONTRARIAN_MYTH_BUST',
    ptHour: 13,
    ptMinute: 0,
    allowedFormats: ['PHOTOREALISTIC_MINIMAL_TECH', 'PHOTOREALISTIC_EXPERT_SHOCK'],
    preferredAngles: [
      'REACTIVE_SENTIMENT', 'HYPOTHETICAL_REVERSAL', 'BEHAVIORAL_RECEIPT',
    ],
    preferredHookFormulas: ['MYTH_STRIKE', 'PREMIUM_CONTRARIAN', 'REVERSE_SURVIVORSHIP'],
    preferredCtas: ['question_open', 'comment_genuine_question', 'share_use_case'],
    description: 'Contrarian / myth-bust — opinion, sentiment-reactive (manual)',
  },
  5: {
    index: 5,
    persona: 'LIFESTYLE_STORYTELLING',
    ptHour: 14,
    ptMinute: 0,
    allowedFormats: ['PHOTOREALISTIC_LUXURY_LIFESTYLE'],
    preferredAngles: [
      'HYPOTHETICAL_REVERSAL', 'BEHAVIORAL_RECEIPT', 'DIVIDEND_KINGS',
    ],
    preferredHookFormulas: ['TIME_CAPSULE', 'COHORT_TRUTH', 'QUIET_COMPOUNDER'],
    preferredCtas: ['save_specific', 'share_use_case', 'reference_save'],
    description: 'Lifestyle / storytelling — time-capsule, wealth psychology',
  },
  6: {
    index: 6,
    persona: 'MEME_HUMOR',
    ptHour: 15,
    ptMinute: 0,
    allowedFormats: ['MEME_HUMOR'],
    preferredAngles: ['HYPOTHETICAL_REVERSAL', 'BEHAVIORAL_RECEIPT', 'COMPARISON_LADDER'],
    preferredHookFormulas: ['REVERSE_SURVIVORSHIP', 'MYTH_STRIKE', 'PREMIUM_CONTRARIAN'],
    preferredCtas: ['share_use_case', 'question_open', 'comment_genuine_question'],
    description: 'Meme / financial humor — lighthearted, funny, eye-catching satire',
  },
};

export function getSlotConfig(index: SlotIndex): SlotConfig {
  return SLOT_CONFIGS[index];
}

const UTC_HOUR_MAP_PDT: Record<number, SlotIndex> = {
  14: 1, 16: 2, 18: 3, 20: 4, 21: 5, 22: 6,
};
const UTC_HOUR_MAP_PST: Record<number, SlotIndex> = {
  15: 1, 17: 2, 19: 3, 21: 4, 22: 5, 23: 6,
};

const SLOT_MINUTES: Record<SlotIndex, number> = {
  1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
};

/**
 * Resolve slot index from the cron schedule string '${minute} ${hour} * * *'.
 * Returns null if the schedule doesn't map to any slot in either DST flavor.
 */
export function resolveSlotFromCron(scheduleStr: string, isVancouverDst: boolean): SlotIndex | null {
  const parts = scheduleStr.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const cronMinute = Number(parts[0]);
  const cronHour = Number(parts[1]);

  const map = isVancouverDst ? UTC_HOUR_MAP_PDT : UTC_HOUR_MAP_PST;
  const slot = map[cronHour];
  if (!slot) return null;

  if (SLOT_MINUTES[slot] !== cronMinute) return null;

  return slot;
}

/** Vancouver is in DST (PDT, UTC-7) roughly mid-March through early November. */
export function isVancouverInDst(now: Date = new Date()): boolean {
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Vancouver',
    timeZoneName: 'short',
  }).format(now);
  return tzName.includes('PDT');
}
