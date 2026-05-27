import { HOOK_FORMULAS, isHookFormulaId, type HookFormulaId } from './hookFormulas';

export interface HookQualityResult {
  valid: boolean;
  failures: string[];
  suggestedReplacementFormulaId?: HookFormulaId;
}

const VAGUE_NOUNS = ['thing', 'secret', 'truth', 'stuff', 'something'];
const VAGUE_PHRASES = [
  "they don't want you to know",
  "they dont want you to know",
  'nobody is talking about',
  'wall street hates',
  'this will change everything',
];
const HYPE_VERBS = [
  'explodes', 'moons', 'blasts off', 'skyrockets', "can't miss", 'must buy', 'must-buy',
  'insane', 'crazy', 'shocking',
];
const WSB_TONE = ['degen', 'tendies', 'bagholder', 'yolo', 'to the moon', 'rocket emoji'];
const ENTITY_HINTS_REGEX = /\b([A-Z]{2,5}|TFSA|RRSP|FHSA|HISA|GIC|ETF|MER|XEQT|VFV|NVDA|AAPL|MSFT|RBC|TD|BMO|CIBC|Berkshire|Pelosi|Trump|Buffett|Powell|Carney|Macklem|Trudeau|Shopify|Apple|Microsoft|Google|Tesla|Meta|Amazon|Netflix|NVIDIA|Bell|Telus|Manulife|Lilly|Pfizer|Moderna)\b/;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'before', 'after', 'your', 'you', 'this', 'that',
  'into', 'from', 'what', 'which', 'when', 'where', 'these', 'those', 'still',
  'here', 'just', 'about', 'over', 'than', 'them', 'they', 'would', 'could',
  'should', 'will', 'have', 'been', 'were', 'their', 'really', 'most', 'some',
  'next', 'check', 'look', 'know', 'much', 'very', 'much', 'many', 'good',
]);

export class HookQualityGate {
  check(input: {
    hook: string;
    slideBreakdown: string[];
    hookFormulaId: string | undefined;
    slotPreferredFormulas: HookFormulaId[];
  }): HookQualityResult {
    const failures: string[] = [];
    let suggestedReplacement: HookFormulaId | undefined;

    if (!isHookFormulaId(input.hookFormulaId)) {
      failures.push(`Invalid or missing hookFormulaId='${input.hookFormulaId ?? ''}'`);
      const fallback = input.slotPreferredFormulas.find((id) => isHookFormulaId(id));
      if (fallback) suggestedReplacement = fallback;
    }

    if (!substantiated(input.hook, input.slideBreakdown)) {
      failures.push('Hook substantiation failed: no shared noun stem with slide breakdown');
    }

    if (hasVagueNounWithoutEntity(input.hook)) {
      failures.push('Vague noun (thing/secret/truth) without concrete entity');
    }
    if (containsAny(input.hook, VAGUE_PHRASES)) {
      failures.push('Contains banned vague phrase');
    }

    if (containsAny(input.hook, HYPE_VERBS)) {
      failures.push('Contains hype verb (explodes/moons/insane/etc.)');
    }
    if (containsAny(input.hook, WSB_TONE)) {
      failures.push('Contains WSB tone (degen/tendies/yolo/etc.)');
    }

    const wordCount = input.hook.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 4) failures.push(`Hook too short: ${wordCount} words (min 4)`);
    if (wordCount > 11) failures.push(`Hook too long: ${wordCount} words (max 11)`);

    return {
      valid: failures.length === 0,
      failures,
      suggestedReplacementFormulaId: suggestedReplacement,
    };
  }
}

function tokensWithStems(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
      .map(stem),
  );
}

function stem(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
}

function substantiated(hook: string, slideBreakdown: string[]): boolean {
  const hookTokens = tokensWithStems(hook);
  if (hookTokens.size === 0) return false;
  const breakdownText = slideBreakdown.slice(1).join(' ');
  const breakdownTokens = tokensWithStems(breakdownText);
  for (const t of hookTokens) {
    if (breakdownTokens.has(t)) return true;
  }
  return false;
}

function hasVagueNounWithoutEntity(hook: string): boolean {
  const lower = hook.toLowerCase();
  const hasVague = VAGUE_NOUNS.some((n) => new RegExp(`\\b${n}\\b`, 'i').test(lower));
  if (!hasVague) return false;
  return !ENTITY_HINTS_REGEX.test(hook);
}

function containsAny(hook: string, patterns: string[]): boolean {
  const lower = hook.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

export function getDeterministicFallbackHookFormula(
  preferredFormulas: HookFormulaId[],
  dayOfYear: number,
): HookFormulaId {
  if (preferredFormulas.length === 0) {
    const allIds = Object.keys(HOOK_FORMULAS) as HookFormulaId[];
    return allIds[dayOfYear % allIds.length];
  }
  return preferredFormulas[dayOfYear % preferredFormulas.length];
}
